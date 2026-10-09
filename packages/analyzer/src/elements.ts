import type { DiagnosticCode, Fix, RelatedInformation } from "@unframework/diagnostics";
import {
  HTML_ELEMENTS,
  isSvgElement,
  OBSOLETE_ELEMENTS,
  PERMITTED_CHILDREN,
  REPAIRED_DESCENDANTS,
  REQUIRED_PARENTS,
  SVG_ELEMENTS,
  SVG_HTML_INTEGRATION_POINTS,
  SVG_UNRENDERABLE_ELEMENTS,
  TEXT_ONLY_ELEMENTS,
  UNPORTABLE_ELEMENTS,
  UNRENDERABLE_ELEMENTS,
} from "@unframework/ir";
import type { Namespace } from "@unframework/ir";
import type { AST } from "@unframework/parser";

import { list } from "./attributes.ts";
import type { Reporter } from "./context.ts";

/** An open element, for the nesting checks of its descendants. */
export interface OpenElement {
  tag: string;
  /** The tag name in the opening tag. */
  name: { start: number; end: number };
  /** The element's own namespace: an `<svg>` and everything inside it are SVG (ADR-0040). */
  namespace: Namespace;
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
  ["keep-alive", "suspense", "teleport", "transition", "transition-group"].map((tag) => [
    tag,
    "Vue",
  ]),
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
   * Whether its children are in a language the analyser does not check (MathML, an SVG
   * `<foreignObject>`, a `<script>`), which would only be misreported: the element is reported
   * once, and nothing inside it.
   */
  foreign?: boolean;
}

/**
 * Checks an element's tag, reporting a problem with it. `parent` is the namespace the element
 * sits in, and `root` whether it is a component's root.
 */
export function checkTag(
  node: AST.JSXElement,
  name: AST.JSXIdentifier,
  parent: Namespace,
  root: boolean,
  reporter: Reporter,
): TagCheck {
  const problem =
    parent === "svg" ? svgTagProblem(node, name.name) : tagProblem(node, name.name, root);
  if (!problem) return { accepted: true, as: name.name };
  report(reporter, name, problem);
  if (problem.fixedTag) return { accepted: false, as: problem.fixedTag };
  return problem.foreign ? { accepted: false, foreign: true } : { accepted: false };
}

/** Why a tag inside an `<svg>` is not an SVG element a component can render (ADR-0040). */
function svgTagProblem(node: AST.JSXElement, tag: string): Problem | undefined {
  const unrenderable = SVG_UNRENDERABLE_ELEMENTS.get(tag);
  if (unrenderable) {
    return tag === "foreignObject"
      ? { code: "UF1002", message: unrenderable, foreign: true }
      : { code: "UF3002", message: unrenderable, foreign: true };
  }
  if (SVG_ELEMENTS.has(tag)) return undefined;
  if (tag === "a") {
    return {
      code: "UF1002",
      message:
        "Links inside an `<svg>` are not supported yet: Vue does not know SVG's `<a>`, and Solid creates it as an HTML link. They land in a later milestone.",
    };
  }
  const svg = [...SVG_ELEMENTS].find((element) => element.toLowerCase() === tag.toLowerCase());
  if (svg) {
    return {
      code: "UF3001",
      message: `<${tag}> is written <${svg}>: SVG elements keep SVG's own case.`,
      fixes: [renameFix(node, svg)],
      fixedTag: svg,
    };
  }
  if (HTML_ELEMENTS.has(tag.toLowerCase())) {
    return {
      code: "UF3001",
      message: `<${tag}> is an HTML element, which cannot be inside an <svg>: the HTML parser ends the SVG before it.`,
      help: "Close the <svg> first, or use an SVG element such as <text>.",
    };
  }
  return { code: "UF3001", message: `<${tag}> is not an SVG element a component can render.` };
}

function tagProblem(node: AST.JSXElement, tag: string, root: boolean): Problem | undefined {
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
  if (HTML_ELEMENTS.has(tag) || tag === "svg") return undefined;
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
  if (lower !== tag && (HTML_ELEMENTS.has(lower) || lower === "svg")) {
    // The fix only leads somewhere the compiler accepts.
    const fixable = !tagProblem(node, lower, root);
    return {
      code: "UF3001",
      message: `<${tag}> is written <${lower}>: HTML elements are lower case.`,
      ...(fixable ? { fixes: [renameFix(node, lower)], fixedTag: lower } : {}),
    };
  }
  if (isSvgElement(tag)) {
    // A component's root takes its namespace from its parent, which Vue's templates cannot
    // declare (ADR-0054): it lands with M8.
    return root
      ? {
          code: "UF1002",
          message: `A component whose root is an SVG <${tag}> is not supported yet: its namespace comes from its parent, which lands in M8.`,
          help: "Make the <svg> the root.",
        }
      : {
          code: "UF3001",
          message: `<${tag}> is an SVG element: it belongs inside an <svg>.`,
          help: "Put it inside an <svg>.",
        };
  }
  // Custom elements land with their own design (a later milestone). Each target needs a
  // contract for them first: Angular's strict templates need `schemas:
  // [CUSTOM_ELEMENTS_SCHEMA]`, Vue needs `isCustomElement`, and every framework sets their
  // properties its own way.
  if (tag.includes("-")) {
    return { code: "UF1002", message: `Custom elements such as <${tag}> are not supported yet.` };
  }
  if (OBSOLETE_ELEMENTS.has(lower)) {
    return { code: "UF3001", message: `<${tag}> is obsolete: HTML no longer defines it.` };
  }
  return {
    code: "UF3001",
    message: `<${tag}> is not an HTML element.`,
    help: "Components are PascalCase (`<Card>`), SVG elements sit inside an <svg>, and MathML is not supported yet.",
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
  atRoot = true,
): void {
  const parent = ancestors.at(-1);
  const problem =
    parent?.namespace === "svg"
      ? svgPlacementProblem(tag, parent)
      : placementProblem(tag, ancestors, atRoot);
  if (problem) report(reporter, name, problem);
}

/**
 * The SVG elements that hold text only: the HTML parser and Vue read an element inside them as
 * HTML, and React as SVG (ADR-0040).
 */
function svgPlacementProblem(tag: string, parent: OpenElement): Problem | undefined {
  if (!SVG_HTML_INTEGRATION_POINTS.has(parent.tag)) return undefined;
  return {
    code: "UF3003",
    message: `<${tag}> cannot be inside an SVG <${parent.tag}>: it holds text only, and the HTML parser and Vue read an element there as HTML, where React keeps it SVG.`,
    related: [{ span: parent.name, message: `The <${parent.tag}>` }],
  };
}

function placementProblem(
  tag: string,
  ancestors: readonly OpenElement[],
  atRoot: boolean,
): Problem | undefined {
  const parent = ancestors.at(-1);
  const parents = REQUIRED_PARENTS.get(tag);
  if (!parent) {
    // A component's own root: the parent's compile checks it where the component sits
    // (ADR-0054). Anywhere else without a parent here (a slot's fill, a root component's root)
    // nothing places it where it belongs.
    if (atRoot || !parents) return undefined;
    return {
      code: "UF3003",
      message: `<${tag}> belongs inside ${list(tags(parents), "or")}, and nothing here places it there: only a component's own root element leaves its parent to the component that renders it.`,
      help: `Write the ${list(tags(parents), "or")} it belongs in around it, in this template.`,
    };
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
