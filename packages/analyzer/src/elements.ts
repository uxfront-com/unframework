import type { DiagnosticCode, Fix, RelatedInformation } from "@unframework/diagnostics";
import {
  HTML_ELEMENTS,
  OBSOLETE_ELEMENTS,
  PERMITTED_CHILDREN,
  REPAIRED_DESCENDANTS,
  REQUIRED_PARENTS,
  TEXT_ONLY_ELEMENTS,
  UNPORTABLE_ELEMENTS,
  UNRENDERABLE_ELEMENTS,
} from "@unframework/ir";
import type { AST } from "@unframework/parser";

import { list } from "./attributes.ts";
import type { Reporter } from "./context.ts";

/** An open element, for the nesting checks of its descendants. */
export interface OpenElement {
  tag: string;
  /** The tag name in the opening tag. */
  name: { start: number; end: number };
}

interface Problem {
  code: DiagnosticCode;
  message: string;
  help?: string;
  fixes?: Fix[];
  related?: RelatedInformation[];
  /** The element the fix turns it into, which the rest of the checks treat it as. */
  fixedTag?: string;
  /** Whether its content is in another language, which the analyser does not check. */
  foreign?: boolean;
}

/** Framework built-ins written as lower-case tags, and their framework. */
const FRAMEWORK_ELEMENTS: ReadonlyMap<string, string> = new Map(
  ["component", "keep-alive", "suspense", "teleport", "transition", "transition-group"].map(
    (tag) => [tag, "Vue"],
  ),
);

/** The outcome of {@link checkTag}. */
export interface TagCheck {
  /** Whether a component can render the element as written. */
  accepted: boolean;
  /**
   * The HTML element to check the element's attributes, placement and children as: the tag
   * itself, or the one a fix turns it into (`<dIV>` → `<div>`), so that applying the fix
   * reveals no new problem. Absent when nothing can be checked against it.
   */
  as?: string;
  /**
   * Whether its children are SVG or MathML, which would only be misreported as HTML: the
   * element is reported once, and M1 (SVG) lowers what is inside it.
   */
  foreign?: boolean;
}

/** Checks an element's tag, reporting a problem with it. */
export function checkTag(
  node: AST.JSXElement,
  name: AST.JSXIdentifier,
  reporter: Reporter,
): TagCheck {
  const problem = tagProblem(node, name.name);
  if (!problem) return { accepted: true, as: name.name };
  report(reporter, name, problem);
  if (problem.fixedTag) return { accepted: false, as: problem.fixedTag };
  return problem.foreign ? { accepted: false, foreign: true } : { accepted: false };
}

function tagProblem(node: AST.JSXElement, tag: string): Problem | undefined {
  const unrenderable = UNRENDERABLE_ELEMENTS.get(tag);
  if (unrenderable) return { code: "UF3002", message: unrenderable };
  const unportable = UNPORTABLE_ELEMENTS.get(tag);
  if (unportable) {
    const fixes = tag === "search" ? searchFix(node) : [];
    return {
      code: "UF1002",
      message: `<${tag}> is not supported yet: ${unportable}`,
      ...(tag === "search" ? { help: 'A <div role="search"> is the same landmark.' } : {}),
      fixes,
      ...(fixes.length ? { fixedTag: "div" } : {}),
    };
  }
  if (HTML_ELEMENTS.has(tag)) return undefined;
  if (tag === "svg") {
    return { code: "UF1002", message: "SVG (`<svg>`) is not supported yet.", foreign: true };
  }
  if (tag === "math") {
    return { code: "UF1002", message: "MathML (`<math>`) is not supported yet.", foreign: true };
  }
  const framework = FRAMEWORK_ELEMENTS.get(tag) ?? (tag.startsWith("ng-") ? "Angular" : undefined);
  if (framework) {
    return {
      code: "UF3002",
      message: `<${tag}> is one of ${framework}'s built-in elements, so ${framework} would not render it as an element.`,
    };
  }
  const lower = tag.toLowerCase();
  if (lower !== tag && HTML_ELEMENTS.has(lower)) {
    // The fix only leads somewhere the compiler accepts.
    const fixable = !tagProblem(node, lower);
    return {
      code: "UF3001",
      message: `<${tag}> is written <${lower}>: HTML elements are lower case.`,
      ...(fixable ? { fixes: [renameFix(node, lower)], fixedTag: lower } : {}),
    };
  }
  // Custom elements land with their own design (M1 or later). Each target needs a contract
  // for them first: Angular's strict templates need `schemas: [CUSTOM_ELEMENTS_SCHEMA]`, Vue
  // needs `isCustomElement`, and every framework sets their properties its own way.
  if (tag.includes("-")) {
    return { code: "UF1002", message: `Custom elements such as <${tag}> are not supported yet.` };
  }
  if (OBSOLETE_ELEMENTS.has(lower)) {
    return { code: "UF3001", message: `<${tag}> is obsolete: HTML no longer defines it.` };
  }
  return {
    code: "UF3001",
    message: `<${tag}> is not an HTML element.`,
    help: "Components are PascalCase (`<Card>`); SVG and MathML elements are not supported yet.",
  };
}

/**
 * `<search>` → `<div role="search">`, unless the element already has a role. The landmark is
 * the same, but the element is not (type selectors and `querySelector("search")` stop
 * matching), so the fix is only likely.
 */
function searchFix(node: AST.JSXElement): Fix[] {
  const hasRole = node.openingElement.attributes.some(
    (item) =>
      item.type === "JSXAttribute" &&
      item.name.type === "JSXIdentifier" &&
      item.name.name.toLowerCase() === "role",
  );
  if (hasRole) return [];
  const fix = renameFix(node, "div");
  fix.edits.push({
    span: { start: node.openingElement.name.end, end: node.openingElement.name.end },
    text: ' role="search"',
  });
  return [{ ...fix, title: 'Use <div role="search">', confidence: "likely" }];
}

function renameFix(node: AST.JSXElement, tag: string): Fix {
  const names = [node.openingElement.name, node.closingElement?.name].filter(
    (name) => name !== undefined,
  );
  return {
    title: `Write <${tag}>`,
    confidence: "safe",
    edits: names.map((name) => ({ span: { start: name.start, end: name.end }, text: tag })),
  };
}

/**
 * Checks where an element sits: the nesting the HTML parser repairs, which would make
 * server-rendered HTML and the client's DOM differ (`REPAIRED_DESCENDANTS`,
 * `PERMITTED_CHILDREN`, `REQUIRED_PARENTS`, text-only elements). `ancestors` are the open
 * elements, the parent last. Reports the first problem found.
 *
 * Invalid nesting that no parser or framework repairs (a `<div>` in a `<span>`, a `<button>`
 * in an `<a>`) renders alike on every target, so it is not checked here; HTML validation
 * belongs with the lint layer (L5, M1).
 */
export function checkPlacement(
  tag: string,
  name: AST.JSXIdentifier,
  ancestors: readonly OpenElement[],
  reporter: Reporter,
): void {
  const problem = placementProblem(tag, ancestors);
  if (problem) report(reporter, name, problem);
}

function placementProblem(tag: string, ancestors: readonly OpenElement[]): Problem | undefined {
  const parent = ancestors.at(-1);
  const parents = REQUIRED_PARENTS.get(tag);
  if (!parent) {
    // A component's root: it cannot know its parent yet, so it cannot need a particular one.
    // Composition (M3) can lift this for a row or a cell component rendered in its table.
    return parents
      ? {
          code: "UF3003",
          message: `<${tag}> cannot be a component's root: it belongs inside ${list(tags(parents), "or")}, and a component does not know its parent.`,
        }
      : undefined;
  }
  const opened = (element: OpenElement, message: string): RelatedInformation[] => [
    { span: element.name, message },
  ];
  if (TEXT_ONLY_ELEMENTS.has(parent.tag)) {
    return {
      code: "UF3003",
      message: `<${tag}> cannot be inside <${parent.tag}>: its content is text, and the browser reads markup there as text.`,
      related: opened(parent, `The <${parent.tag}>`),
    };
  }
  if (parents && !parents.has(parent.tag)) {
    return {
      code: "UF3003",
      message: `<${tag}> cannot be a child of <${parent.tag}>: it belongs inside ${list(tags(parents), "or")}.`,
      help: tag === "tr" && parent.tag === "table" ? "Wrap the rows in a <tbody>." : undefined,
      related: opened(parent, "The parent"),
    };
  }
  const permitted = PERMITTED_CHILDREN.get(parent.tag);
  if (permitted && !permitted.has(tag)) {
    return {
      code: "UF3003",
      message: `<${tag}> cannot be a child of <${parent.tag}>: the browser moves it out or drops it. Only ${list(tags(permitted))} can be.`,
      related: opened(parent, "The parent"),
    };
  }
  for (let index = ancestors.length - 1; index >= 0; index--) {
    const ancestor = ancestors[index]!;
    const rule = REPAIRED_DESCENDANTS.get(ancestor.tag);
    if (!rule?.descendants.has(tag)) continue;
    const between = ancestors.slice(index + 1);
    if (rule.resetBy && between.some((element) => rule.resetBy!.has(element.tag))) continue;
    return {
      code: "UF3003",
      message: `<${tag}> cannot be inside <${ancestor.tag}>: ${repairOf(ancestor.tag)}`,
      related: opened(ancestor, `The <${ancestor.tag}>`),
    };
  }
  return undefined;
}

/** What the parser does when the element opens inside an ancestor it repairs. */
function repairOf(ancestor: string): string {
  if (ancestor === "form") return "the browser ignores a form inside a form.";
  if (ancestor === "a" || ancestor === "button") {
    return `the browser closes the outer <${ancestor}> first.`;
  }
  return `the browser closes the <${ancestor}> before it.`;
}

function tags(names: ReadonlySet<string>): string[] {
  return [...names].filter((name) => !UNRENDERABLE_ELEMENTS.has(name)).map((name) => `<${name}>`);
}

function report(reporter: Reporter, name: AST.JSXIdentifier, problem: Problem): void {
  if (problem.code === "UF1002") {
    reporter.unsupported(name, problem.message, {
      ...(problem.help ? { help: problem.help } : {}),
      ...(problem.fixes?.length ? { fixes: problem.fixes } : {}),
    });
    return;
  }
  reporter.report(problem.code, name, problem.message, {
    ...(problem.help ? { help: problem.help } : {}),
    ...(problem.fixes?.length ? { fixes: problem.fixes } : {}),
    ...(problem.related?.length ? { related: problem.related } : {}),
  });
}
