import {
  createElement,
  createText,
  isVoidElement,
  isWhitespaceText,
  TEXTLESS_ELEMENTS,
  WHITESPACE_DROPPING_ELEMENTS,
} from "@unframework/ir";
import type { ElementNode, RenderNode } from "@unframework/ir";
import type { AST } from "@unframework/parser";

import { lowerAttributes } from "./attributes.ts";
import { unportableCharacters } from "./characters.ts";
import { reportCharacter, reportDivergence, reportHtmlOnlyReference } from "./context.ts";
import type { Reporter } from "./context.ts";
import { checkPlacement, checkTag } from "./elements.ts";
import type { OpenElement } from "./elements.ts";
import { htmlOnlyReferences, readJsxText } from "./jsx/text.ts";
import type { JsxReading } from "./jsx/text.ts";

/**
 * Lowers a JSX element to an IR element. Constructs outside the supported subset, and markup
 * the targets would render differently, are reported and left out, so one problem never
 * hides the next. `ancestors` are the open elements around it, the parent last.
 */
export function lowerElement(
  node: AST.JSXElement,
  reporter: Reporter,
  ancestors: readonly OpenElement[] = [],
): ElementNode | undefined {
  const name = node.openingElement.name;
  if (name.type !== "JSXIdentifier") {
    reporter.unsupported(
      name,
      name.type === "JSXNamespacedName"
        ? "Namespaced elements are not supported yet."
        : "Member-expression components are not supported yet.",
    );
    return undefined;
  }
  if (/^[A-Z]/.test(name.name)) {
    reporter.unsupported(name, `Child components such as <${name.name}> are not supported yet.`);
    return undefined;
  }
  const check = checkTag(node, name, reporter);
  if (!check.as) {
    // Nothing to check the element as; its children are still checked, inside it, unless they
    // are SVG or MathML, which the HTML checks would only misreport.
    if (!check.foreign) {
      lowerChildren(node.children, reporter, [...ancestors, { tag: name.name, name: span(name) }]);
    }
    return undefined;
  }
  const tag = check.as;
  checkPlacement(tag, name, ancestors, reporter);
  const content = hasContent(node.children);
  const attributes = lowerAttributes(tag, node.openingElement, content, reporter);
  let children: RenderNode[] = [];
  if (!isVoidElement(tag)) {
    children = lowerChildren(node.children, reporter, [...ancestors, { tag, name: span(name) }]);
  } else if (content) {
    reporter.report("UF3003", name, `<${tag}> is a void element, so it cannot have children.`, {
      help: `Write it as \`<${tag} />\`, and move the children after it.`,
    });
  }
  if (!check.accepted) return undefined;
  return createElement(tag, attributes, children, { start: node.start, end: node.end });
}

function lowerChildren(
  items: readonly AST.JSXChild[],
  reporter: Reporter,
  ancestors: readonly OpenElement[],
): RenderNode[] {
  const parent = ancestors.at(-1)!;
  const children: RenderNode[] = [];
  for (const item of items) {
    switch (item.type) {
      case "JSXText": {
        const reading = readJsxText(item.value);
        const lowered = checkText(item, reading, parent, reporter);
        if (!lowered || !reading.value) break;
        const previous = children.at(-1);
        // Text split only by a JSX comment is one DOM text node.
        if (previous?.kind === "Text") {
          children[children.length - 1] = createText(previous.value + reading.value, {
            start: previous.span.start,
            end: item.end,
          });
        } else {
          children.push(createText(reading.value, { start: item.start, end: item.end }));
        }
        break;
      }
      case "JSXExpressionContainer":
        if (item.expression.type !== "JSXEmptyExpression") {
          reporter.unsupported(item, "Expressions in JSX (`{…}`) are not supported yet.");
        }
        break;
      case "JSXElement": {
        const element = lowerElement(item, reporter, ancestors);
        if (element) children.push(element);
        break;
      }
      case "JSXFragment":
        reporter.unsupported(item, "Fragments (`<>…</>`) are not supported yet.");
        break;
      case "JSXSpreadChild":
        reporter.unsupported(item, "Spread children (`{...children}`) are not supported yet.");
        break;
    }
  }
  return children;
}

/**
 * Checks a text child, and whether it can be lowered: every JSX implementation must read it
 * the same way (UF3009), it must sit where the targets keep text alike (UF3003), and HTML must
 * keep its characters (UF3010). Babel's reading is checked even where the implementations
 * disagree, so the fixes for the disagreement reveal no new problem. A reference only HTML
 * decodes is a warning (UF3011): the text is lowered as JSX reads it.
 */
function checkText(
  item: AST.JSXText,
  reading: JsxReading,
  parent: OpenElement,
  reporter: Reporter,
): boolean {
  const at = (range: { start: number; end: number }) => ({
    start: item.start + range.start,
    end: item.start + range.end,
  });
  for (const divergence of reading.divergences) {
    reportDivergence(divergence, at, reporter);
  }
  for (const reference of htmlOnlyReferences(item.value)) {
    // Its numeric reference reads alike everywhere, except as a tab or a line break, which
    // Babel reads as whitespace (UF3009); and where the text is read differently already, the
    // divergence's message would change with it.
    const fixable =
      !reading.divergences.length && reference.value !== "\t" && reference.value !== "\n";
    reportHtmlOnlyReference(reference, at, fixable, reporter);
  }
  let lowered = reading.divergences.length === 0;
  const { value } = reading;
  const related = [{ span: parent.name, message: `The <${parent.tag}>` }];
  const whitespace = isWhitespaceText(value);
  // Whitespace there renders nothing, so removing it is safe, unless a fix for a divergence
  // in it (`&#9;`) edits it already.
  const removal = {
    help: `Remove it, or put the ${TEXTLESS_ELEMENTS.has(parent.tag) ? "children" : "options"} on lines of their own, where JSX drops it.`,
    fixes: reading.divergences.length
      ? []
      : [
          {
            title: "Remove the whitespace",
            confidence: "safe" as const,
            edits: [{ span: span(item), text: "" }],
          },
        ],
    related,
  };
  if (value && TEXTLESS_ELEMENTS.has(parent.tag)) {
    // The parser keeps whitespace in a table where it is, and moves any other text before it.
    if (whitespace) {
      reporter.report(
        "UF3003",
        item,
        `Text cannot be inside <${parent.tag}>, not even whitespace: React reports it as a hydration error, and Svelte's compiler drops it.`,
        removal,
      );
    } else {
      reporter.report(
        "UF3003",
        item,
        `Text cannot be inside <${parent.tag}>: the browser moves it out of the table.`,
        { help: "Put it in a cell, or in a <caption>.", related },
      );
    }
    return false;
  }
  // Svelte's compiler drops it (`checkInvariants` rejects it too).
  if (value && WHITESPACE_DROPPING_ELEMENTS.has(parent.tag) && whitespace) {
    reporter.report(
      "UF3003",
      item,
      `Text that is only whitespace cannot be inside <${parent.tag}>: Svelte's compiler drops it, and the other targets keep it.`,
      removal,
    );
    lowered = false;
  }
  const characters = unportableCharacters(item.value, reading.kept, reading.divergences);
  for (const character of characters) {
    reportCharacter(character, at, reporter);
    lowered = false;
  }
  return lowered;
}

function span(node: { start: number; end: number }): { start: number; end: number } {
  return { start: node.start, end: node.end };
}

/** Whether JSX children have content: an element, an expression, or text some JSX reads. */
function hasContent(items: readonly AST.JSXChild[]): boolean {
  return items.some((item) => {
    if (item.type !== "JSXText") {
      return (
        item.type !== "JSXExpressionContainer" || item.expression.type !== "JSXEmptyExpression"
      );
    }
    const reading = readJsxText(item.value);
    return reading.value !== "" || reading.divergences.length > 0;
  });
}
