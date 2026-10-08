// The Node half of the render-parity kit (./render-parity.ts): lowering the source cases with the
// analyser, writing a suite's cases into one component, emitting it through a target, reading
// which cases its capability matrix declares unsupported, the attribute sweeps, and the Vite
// plugin that serves the emitted components to a target package's browser project, where the
// framework's own client renderer mounts them.
import { sep } from "node:path";
import { fileURLToPath } from "node:url";

import { analyze, enumeratedValues, staticTokens } from "@unframework/analyzer";
import {
  ARIA_ATTRIBUTES,
  checkInvariants,
  createComponent,
  createElement,
  createExport,
  createModule,
  ELEMENT_ATTRIBUTES,
  expressionsOf,
  FIXED_VALUE_INPUT_TYPES,
  GLOBAL_ATTRIBUTES,
  HTML_ELEMENTS,
  isBooleanAttribute,
  isNumberTypedAttribute,
  isVoidElement,
  NUMERIC_ATTRIBUTES,
  REQUIRED_PARENTS,
  span,
  SVG_ELEMENT_ATTRIBUTES,
  SVG_ELEMENTS,
  SVG_GLOBAL_ATTRIBUTES,
  SVG_TEXT_ELEMENTS,
  TRUE_VALUED_ATTRIBUTES,
  URL_ATTRIBUTES,
} from "@unframework/ir";
import type { Namespace, UfComponent, UfModule } from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import type { Plugin } from "vite";
import type { TestProjectInlineConfiguration, ViteUserConfig } from "vitest/config";
import type { BrowserProviderOption } from "vitest/node";

import { BEHAVIOURAL_CAPABILITIES, formatOutput, requiredCapabilities } from "../src/index.ts";
import type { CapabilityName, EmitContext, OutputFile, Target } from "../src/index.ts";
import type { ClientCase } from "./render-parity-client.ts";
import {
  FUZZ_SOURCE_SEEDS,
  fuzzSource,
  ROOT_SOURCES,
  ROOT_SOURCE_SEEDS,
  TRICKY_SOURCES,
} from "./render-parity-sources.ts";
import { CARRIAGE_RETURN_CASES, expectedTree, PARITY_SUITES } from "./render-parity.ts";
import type {
  LoweredCase,
  ParityCase,
  ParitySuite,
  SourceCase,
  StaticCase,
} from "./render-parity.ts";

/** The name the parity component is emitted under. */
const PARITY_COMPONENT = "RenderParity";

const at = { start: 0, end: 0 };

/** How {@link lowerSources} treats a case the analyser rejects. */
type Rejected = "throw" | "drop";

/**
 * Lowers source cases as the compiler lowers an author's module: all of them in one module, each
 * its own exported component (`Case<index>`) after every case's type declarations, analysed once
 * and checked against the IR's invariants. Each case keeps the module text and its own component;
 * a module of that component alone answers what capabilities it uses. A case the analyser
 * rejects, or with any diagnostic at all, fails loudly with the diagnostics, unless `rejected` is
 * `"drop"` (the bound sweep tries alternatives and keeps the first it accepts). A key of `props`
 * that is no prop, or a required prop without a value, fails too: the case would test nothing.
 */
export function lowerSources(
  specs: readonly SourceCase[],
  rejected: Rejected = "throw",
  codes?: Map<number, string[]>,
): (ParityCase | undefined)[] {
  const file = "Cases.uf.tsx";
  let text = specs.map(({ types }) => (types ? `${types.trim()}\n\n` : "")).join("");
  const ranges = specs.map((spec, index) => {
    const head = `export function Case${index}(${spec.params ?? ""}) {\n  return (\n    `;
    const jsx = spec.jsx.trim();
    const start = text.length;
    text += `${head}${jsx}\n  );\n}\n\n`;
    return {
      whole: span(start, text.length),
      jsx: span(start + head.length, start + head.length + jsx.length),
    };
  });
  const { module, diagnostics } = analyze(parseModule(file, text));
  const describe = (index: number) => {
    const { whole } = ranges[index]!;
    const own = diagnostics.filter(
      ({ span: where }) => where.start >= whole.start && where.end <= whole.end,
    );
    return `${specs[index]!.name}:\n${own
      .map(
        ({ code, message, span: where }) =>
          `  ${code} ${message} (${JSON.stringify(text.slice(where.start, where.end))})`,
      )
      .join("\n")}\n${text.slice(whole.start, whole.end)}`;
  };
  const owned = new Set<number>();
  for (const diagnostic of diagnostics) {
    const index = ranges.findIndex(
      ({ whole }) => diagnostic.span.start >= whole.start && diagnostic.span.end <= whole.end,
    );
    if (index < 0) {
      throw new Error(
        `The analyser reports ${diagnostic.code} (${diagnostic.message}) outside every case.`,
      );
    }
    owned.add(index);
  }
  if (!module) {
    // A module-level error drops every component: name the cases it sits in.
    const errors = diagnostics.filter(({ severity }) => severity === "error");
    const caseAt = (start: number) =>
      ranges.findIndex(({ whole }) => start >= whole.start && start < whole.end);
    throw new Error(
      `The analyser rejects the whole module of cases:\n${errors
        .slice(0, 10)
        .map(
          ({ code, message, span: where }) =>
            `  ${code} ${message} (in ${specs[caseAt(where.start)]?.name})`,
        )
        .join("\n")}`,
    );
  }
  const components = new Map(module.components.map((component) => [component.name, component]));
  return specs.map((spec, index) => {
    const component = components.get(`Case${index}`);
    const own = component && componentModule(file, module, component);
    // IR that breaks the invariants is the analyser's bug: loud, and never emitted from.
    const broken = own ? checkInvariants(own) : [];
    if (broken.length) {
      if (rejected === "throw") {
        throw new Error(`${spec.name} lowers to invalid IR: ${JSON.stringify(broken)}`);
      }
      codes?.set(index, [INVALID_IR]);
      return undefined;
    }
    if (owned.has(index) || !component || !own) {
      codes?.set(
        index,
        diagnostics
          .filter(
            ({ span: where }) =>
              where.start >= ranges[index]!.whole.start && where.end <= ranges[index]!.whole.end,
          )
          .map(({ code }) => code),
      );
      if (rejected === "drop") return undefined;
      throw new Error(`The analyser does not accept the case ${describe(index)}`);
    }
    const props = spec.props ?? {};
    const declared = new Map(component.props.map((prop) => [prop.name, prop]));
    for (const name of Object.keys(props)) {
      if (!declared.has(name)) throw new Error(`${spec.name}: \`${name}\` is no prop.`);
    }
    for (const prop of component.props) {
      if (!prop.optional && props[prop.name] === undefined) {
        throw new Error(`${spec.name}: the required prop \`${prop.name}\` has no value.`);
      }
    }
    const lowered: LoweredCase = { text, jsx: ranges[index]!.jsx, module: own, component, props };
    return { name: spec.name, render: component.render, lowered };
  });
}

/**
 * What a sweep records for a candidate whose IR breaks the invariants, in place of the
 * analyser's codes: the analyser accepted what the IR forbids (a bug the sweeps name, rather than
 * a reason to stop every target's parity tests).
 */
export const INVALID_IR = "invalid IR";

/** A module of one of a module's components, with the type declarations it uses. */
function componentModule(file: string, module: UfModule, component: UfComponent): UfModule {
  return createModule(
    file,
    [component],
    [createExport("named", component.name, component.span)],
    module.types.filter(({ name }) => component.types.includes(name)),
  );
}

/** {@link lowerSources} for cases the analyser must accept. */
export function sourceCases(specs: readonly SourceCase[]): ParityCase[] {
  return lowerSources(specs) as ParityCase[];
}

/** A case's prop as the parity component names it: namespaced by the case's index. */
export function namespacedProp(index: number, name: string): string {
  return `c${index}${name[0]!.toUpperCase()}${name.slice(1)}`;
}

const suiteModules = new WeakMap<ParitySuite, UfModule>();

/**
 * The module of a suite: one component, `RenderParity`, that renders every case. Its root is a
 * `<div>` holding each case's root element, or, in a `"self"` suite, the one case's own root.
 * M0's static cases are put together as IR. Source cases are put together as source, which the
 * analyser lowers again, as it would an author's component: every case's type declarations, and
 * one props type with every case's props, namespaced by the case's index (`c12Label`, since the
 * prop-name pattern has no `_`), destructured or read through one object as the suite's `form`
 * says; every reference to a prop in a case's JSX is respelled. Cached per suite.
 */
export function parityModule(suite: ParitySuite): UfModule {
  let module = suiteModules.get(suite);
  if (module) return module;
  const sources = suite.cases.filter((parityCase) => parityCase.lowered).length;
  if (sources && sources !== suite.cases.length) {
    throw new Error(`${suite.title}: a suite is all source cases or all static ones.`);
  }
  if ((suite.root ?? "div") === "self" && suite.cases.length !== 1) {
    throw new Error(`${suite.title}: a "self" suite has exactly one case.`);
  }
  module = sources ? sourceModule(suite) : staticModule(suite);
  suiteModules.set(suite, module);
  return module;
}

/** M0's module: the static trees side by side in a `<div>`, as IR. */
function staticModule(suite: ParitySuite): UfModule {
  const render =
    suite.root === "self"
      ? suite.cases[0]!.render
      : createElement(
          "div",
          [],
          suite.cases.map(({ render: tree }) => tree as StaticCase["render"]),
          at,
        );
  return createModule(
    `${PARITY_COMPONENT}.uf.tsx`,
    [createComponent(PARITY_COMPONENT, render, at)],
    [createExport("default", PARITY_COMPONENT, at)],
  );
}

/** A source suite's module: its cases written into one component, and lowered. */
function sourceModule(suite: ParitySuite): UfModule {
  const form = suite.form ?? "destructured";
  const types: string[] = [];
  const members: string[] = [];
  const pattern: string[] = [];
  const bodies = suite.cases.map((parityCase, index) => {
    const lowered = parityCase.lowered!;
    for (const declaration of lowered.module.types) {
      types.push(`${declaration.exported ? "export " : ""}${declaration.code}`);
    }
    const spelling = new Map<string, string>();
    for (const prop of lowered.component.props) {
      const name = namespacedProp(index, prop.name);
      members.push(`${name}${prop.optional ? "?" : ""}: ${prop.type.code};`);
      if (prop.default && form === "object") {
        throw new Error(
          `${parityCase.name}: a props object cannot give \`${prop.name}\` a default.`,
        );
      }
      if (prop.binding === undefined) continue;
      pattern.push(prop.default ? `${name} = ${prop.default.code}` : name);
      spelling.set(prop.binding, form === "object" ? `props.${name}` : name);
    }
    return respelled(lowered, spelling);
  });
  const parameter = !members.length
    ? ""
    : form === "object"
      ? `props: {\n  ${members.join("\n  ")}\n}`
      : `{ ${pattern.join(", ")} }: ${PARITY_COMPONENT}Props`;
  const declarations = [
    ...types,
    ...(members.length && form === "destructured"
      ? [`interface ${PARITY_COMPONENT}Props {\n  ${members.join("\n  ")}\n}`]
      : []),
  ];
  const body = suite.root === "self" ? bodies[0]! : `<div>\n${bodies.join("\n")}\n</div>`;
  const text = `${declarations.map((declaration) => `${declaration}\n\n`).join("")}export default function ${PARITY_COMPONENT}(${parameter}) {\n  return (\n${body}\n  );\n}\n`;
  const { module, diagnostics } = analyze(parseModule(`${PARITY_COMPONENT}.uf.tsx`, text));
  if (!module || diagnostics.length) {
    const reported = diagnostics.map(
      ({ code, message, span: where }) =>
        `  ${code} ${message} (${JSON.stringify(text.slice(where.start, where.end))})`,
    );
    throw new Error(`The analyser does not accept ${suite.title}:\n${reported.join("\n")}`);
  }
  const broken = checkInvariants(module);
  if (broken.length)
    throw new Error(`${suite.title} lowers to invalid IR: ${JSON.stringify(broken)}`);
  const [component] = module.components as [UfComponent];
  if (suite.root !== "self") {
    const { render } = component;
    if (render.kind !== "Element" || render.children.length !== suite.cases.length) {
      throw new Error(`${suite.title}: a case renders more than one root element.`);
    }
  }
  return module;
}

/**
 * A case's JSX with each reference to a prop spelled as the parity component reads it. A
 * reference that is a shorthand property in the source (`{ label }`, `style={{ color }}`,
 * `class={{ on }}`) is expanded (`label: c0Label`): the IR marks only the shorthands inside one
 * expression's code, and a style declaration's or a toggle's expression is the value alone.
 */
function respelled(lowered: LoweredCase, spelling: ReadonlyMap<string, string>): string {
  const { text, jsx, component } = lowered;
  const shorthands = shorthandValues(text);
  const edits = new Map<number, { end: number; replacement: string }>();
  for (const { expression } of expressionsOf(component)) {
    for (const reference of expression.refs) {
      if (reference.kind !== "Binding" || !spelling.has(reference.binding)) continue;
      const { start, end } = reference.span;
      if (start < jsx.start || end > jsx.end) continue;
      const binding = component.bindings.find(({ id }) => id === reference.binding)!;
      const spelled = spelling.get(reference.binding)!;
      const shorthand = reference.shorthand || shorthands.has(start);
      // One expression can be read twice (a toggle's name and condition): one edit per span.
      edits.set(start, { end, replacement: shorthand ? `${binding.name}: ${spelled}` : spelled });
    }
  }
  let out = "";
  let cursor = jsx.start;
  for (const [start, { end, replacement }] of [...edits].toSorted(([a], [b]) => a - b)) {
    out += text.slice(cursor, start) + replacement;
    cursor = end;
  }
  return out + text.slice(cursor, jsx.end);
}

const shorthandCache = new Map<string, ReadonlySet<number>>();

/** Where each shorthand property's value starts in a module's source. */
function shorthandValues(text: string): ReadonlySet<number> {
  let found = shorthandCache.get(text);
  if (found) return found;
  const starts = new Set<number>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const record = node as { type?: unknown; shorthand?: unknown; value?: { start?: number } };
    if (
      record.type === "Property" &&
      record.shorthand === true &&
      record.value?.start !== undefined
    ) {
      starts.add(record.value.start);
    }
    for (const value of Object.values(node)) if (typeof value === "object") visit(value);
  };
  visit(parseModule("Cases.uf.tsx", text).program);
  found = starts;
  shorthandCache.set(text, found);
  return found;
}

/**
 * The props the parity component of a suite renders with: each case's, namespaced as
 * {@link parityModule} names them. A key a case leaves out stays out, and a key it sets to
 * `undefined` stays `undefined` (an explicit `undefined` must render as an absent prop).
 */
export function parityProps(suite: ParitySuite): Record<string, unknown> {
  return Object.fromEntries(
    suite.cases.flatMap((parityCase, index) =>
      Object.entries(parityCase.lowered?.props ?? {}).map(([name, value]) => [
        namespacedProp(index, name),
        value,
      ]),
    ),
  );
}

/**
 * The capabilities a case uses that the target's matrix marks unsupported, by the derivation
 * the compiler's capability check reads: the compiler reports such a case for the target, so
 * its client test leaves the case out and checks that it still renders differently. A
 * behavioural capability (`BEHAVIOURAL_CAPABILITIES`) changes nothing a static render shows, so
 * it is not one of them (ADR-0033, as amended by ADR-0047): the case still renders exactly,
 * listeners inert, and is compared as any other.
 */
export function unsupportedCapabilities(target: Target, parityCase: ParityCase): CapabilityName[] {
  const module =
    parityCase.lowered?.module ?? parityModule({ title: parityCase.name, cases: [parityCase] });
  return [...requiredCapabilities(module).keys()].filter(
    (capability) =>
      !BEHAVIOURAL_CAPABILITIES.has(capability) &&
      target.capabilities[capability].support === "unsupported",
  );
}

/**
 * What a target emits for a suite's component, formatted as the compiler formats it or left in
 * the printer's layout (the dev server's path). Fails on anything the target reports: what it
 * cannot render exactly, it declares in its capability matrix (`unsupportedCapabilities`). Fails
 * on any formatting error too.
 */
export async function emitParity(
  target: Target,
  suite: ParitySuite,
  { format }: { format: boolean },
): Promise<OutputFile[]> {
  const module = parityModule(suite);
  const reported: Parameters<EmitContext["report"]>[0][] = [];
  const context: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => void reported.push(diagnostic),
  };
  const files = module.components.flatMap((component) => target.emit(component, context));
  if (reported.length) {
    const reports = reported.map(({ code, message }) => `${code} (${message})`).join(", ");
    throw new Error(`${target.name} reported ${reports} for ${suite.title}.`);
  }
  if (!format) return files;
  return Promise.all(
    files.map(async (file) => {
      const outcome = await formatOutput(file);
      if (outcome.error) throw new Error(`${file.path} does not format: ${outcome.error}`);
      return outcome.file;
    }),
  );
}

/** One attribute the sweeps try, with the attributes it only exists beside. */
interface SweepCandidate {
  /** What the case is called. */
  key: string;
  tag: string;
  /** The attribute under test. */
  name: string;
  /** Attributes it only exists beside (`type="submit"`), written statically. */
  extra?: Readonly<Record<string, string>>;
  namespace: Namespace;
}

/** The parent the sweep puts an element in when HTML requires one, where there is a choice. */
const SWEEP_PARENT: Readonly<Record<string, string>> = { tr: "tbody", dd: "dl", dt: "dl" };

/**
 * The content the sweep gives an element whose attributes act on its children, so that they
 * do: a select's `size` and `multiple` and an option group's `disabled` decide which option
 * starts selected, a list's `start`, `reversed` and `type` number its items, and `open` shows
 * what follows a summary.
 */
const SWEEP_CONTENT: Readonly<Record<string, string>> = {
  select: "<option>a</option>",
  optgroup: "<option>a</option>",
  ol: "<li>a</li>",
  ul: "<li>a</li>",
  details: "<summary>a</summary>b",
};

/**
 * The parent the sweep puts an element in where HTML would allow it anywhere, but its
 * attributes act only there: an option's and an option group's `disabled` decide which option
 * a select starts with.
 */
const SWEEP_CONTEXT: Readonly<Record<string, string>> = { option: "select", optgroup: "select" };

/** Inputs whose `value` is a label or a submitted value, which the analyzer accepts. */
const FIXED_VALUE_TYPES = [...FIXED_VALUE_INPUT_TYPES];

/** The attributes that override a form's submission, which only submit buttons take. */
export const SUBMISSION_OVERRIDES: readonly string[] = [
  "formaction",
  "formenctype",
  "formmethod",
  "formnovalidate",
  "formtarget",
];

/** The SVG element the sweep tries SVG's global attributes on. */
const SVG_SWEEP_ELEMENT = "rect";

/**
 * Every attribute the sweeps try: HTML's global and ARIA attributes and a `data-*` one on a
 * `<div>`, every HTML element once (with `title`) and each with its own attributes, `value` on
 * every input type that takes one, the submission overrides on a submit button; then every SVG
 * element once (with `class`), each with its own attributes, and SVG's global attributes on a
 * `<rect>` (ADR-0040). `class` and `style` have kinds of their own, tested by the other suites.
 */
function sweepCandidates(): SweepCandidate[] {
  const candidates: SweepCandidate[] = [];
  const add = (
    key: string,
    tag: string,
    name: string,
    namespace: Namespace = "html",
    extra?: Record<string, string>,
  ) => {
    if (name === "style") return;
    candidates.push({ key, tag, name, namespace, ...(extra ? { extra } : {}) });
  };
  for (const name of [...GLOBAL_ATTRIBUTES, ...ARIA_ATTRIBUTES, "data-x"]) {
    add(`<div ${name}>`, "div", name);
  }
  for (const tag of HTML_ELEMENTS) {
    // Every element once, so each renderer creates each one.
    add(`<${tag}>`, tag, "title");
    for (const name of ELEMENT_ATTRIBUTES.get(tag) ?? []) add(`<${tag} ${name}>`, tag, name);
  }
  for (const type of FIXED_VALUE_TYPES) {
    add(`<input type="${type}" value>`, "input", "value", "html", { type });
  }
  for (const name of SUBMISSION_OVERRIDES) {
    add(`<input type="submit" ${name}>`, "input", name, "html", { type: "submit" });
  }
  for (const tag of SVG_ELEMENTS) {
    add(`<svg:${tag}>`, tag, "class", "svg");
    for (const name of SVG_ELEMENT_ATTRIBUTES.get(tag) ?? []) {
      add(`<svg:${tag} ${name}>`, tag, name, "svg");
    }
  }
  for (const name of SVG_GLOBAL_ATTRIBUTES) {
    if (name !== "class") add(`<svg:${SVG_SWEEP_ELEMENT} ${name}>`, SVG_SWEEP_ELEMENT, name, "svg");
  }
  return candidates;
}

/**
 * The static values the attribute sweep tries for an attribute, most specific first: the
 * analyzer takes the first one it accepts. An enumerated attribute's first keyword every typed
 * target accepts comes first (the analyzer checks static values against them). URLs are `data:`
 * URLs, so nothing a browser renders makes a request.
 */
function sweepValues({ tag, name, namespace }: SweepCandidate): (string | true)[] {
  const keyword = staticTokens(tag, namespace, name)?.[0];
  const first = keyword === undefined ? [] : [keyword];
  if (namespace === "svg") return [...first, "1", "x"];
  if (isBooleanAttribute(name)) return [true];
  if (keyword !== undefined) return first;
  if (NUMERIC_ATTRIBUTES.get(tag)?.has(name)) return ["2"];
  if (TRUE_VALUED_ATTRIBUTES.has(name)) return ["true", "false"];
  if (URL_ATTRIBUTES.has(name) || name.endsWith("srcset")) return ["data:,", "/x"];
  return ["x", "1", "true"];
}

/**
 * JSX for an element with the attribute under test (`written`, as JSX writes it) and the content
 * it acts on, inside the parent it acts in and the parents HTML requires it to have; an SVG
 * element inside an `<svg>`, with text if it is one of SVG's text elements.
 */
function sweepSource(candidate: SweepCandidate, written: string): string {
  const { tag, extra = {}, namespace } = candidate;
  const attributes =
    Object.entries(extra)
      .map(([name, value]) => ` ${name}="${value}"`)
      .join("") + written;
  if (namespace === "svg") {
    const element = SVG_TEXT_ELEMENTS.has(tag)
      ? `<${tag}${attributes}>a</${tag}>`
      : `<${tag}${attributes} />`;
    return tag === "svg" ? element : `<svg>${element}</svg>`;
  }
  let source = isVoidElement(tag)
    ? `<${tag}${attributes} />`
    : `<${tag}${attributes}>${SWEEP_CONTENT[tag] ?? ""}</${tag}>`;
  const context = SWEEP_CONTEXT[tag];
  if (context) source = `<${context}>${source}</${context}>`;
  for (
    let child = tag, parents = REQUIRED_PARENTS.get(child);
    parents;
    parents = REQUIRED_PARENTS.get(child)
  ) {
    child = SWEEP_PARENT[child] ?? [...parents][0]!;
    source = `<${child}>${source}</${child}>`;
  }
  return source;
}

let sweep: readonly StaticCase[] | undefined;

/**
 * The pairs each sweep leaves out, by key, with the codes the analyzer reported for the last
 * value tried: what the vocabulary lists but no target is asked to render.
 */
const drops = { static: new Map<string, string[]>(), bound: new Map<string, string[]>() };

/** The pairs the attribute sweeps leave out, with the analyzer's codes (see `drops`). */
export function sweepDrops(): {
  static: ReadonlyMap<string, readonly string[]>;
  bound: ReadonlyMap<string, readonly string[]>;
} {
  attributeSweep();
  boundAttributeSweep();
  return drops;
}

/**
 * The attribute sweep: every (element, attribute) pair the analyzer accepts written
 * statically, each on its own element, with the first value it accepts, as the IR it lowers it
 * to. The analyzer decides, so the sweep follows what it accepts: an attribute it starts
 * accepting is rendered by every target from then on.
 */
export function attributeSweep(): readonly StaticCase[] {
  if (sweep) return sweep;
  const tries = sweepCandidates().flatMap((candidate) =>
    sweepValues(candidate).map((value) => ({
      candidate,
      written: value === true ? ` ${candidate.name}` : ` ${candidate.name}="${value}"`,
    })),
  );
  let source = "";
  const ranges = tries.map(({ candidate, written }, index) => {
    const start = source.length;
    source += `export function Sweep${index}() {\n  return <div>${sweepSource(candidate, written)}</div>;\n}\n`;
    return { start, end: source.length };
  });
  // A component the analyzer rejects is left out of the module; its siblings are not.
  const { module, diagnostics } = analyze(parseModule("Sweep.uf.tsx", source));
  if (!module) throw new Error("The analyzer rejected the whole attribute sweep.");
  const seen = new Set<string>();
  const cases: StaticCase[] = [];
  const invalid = new Set<string>();
  for (const component of module.components) {
    const { candidate } = tries[Number(component.name.slice("Sweep".length))]!;
    if (seen.has(candidate.key)) continue;
    if (checkInvariants(componentModule("Sweep.uf.tsx", module, component)).length) {
      invalid.add(candidate.key);
      continue;
    }
    seen.add(candidate.key);
    if (component.render.kind !== "Element")
      throw new Error(`${candidate.key} has no root element`);
    cases.push({ name: candidate.key, render: component.render });
  }
  tries.forEach(({ candidate }, index) => {
    if (seen.has(candidate.key)) return;
    const { start, end } = ranges[index]!;
    const reported = diagnostics
      .filter(({ span: where }) => where.start >= start && where.end <= end)
      .map(({ code }) => code);
    drops.static.set(candidate.key, invalid.has(candidate.key) ? [INVALID_IR] : reported);
  });
  // A few hundred pairs; far fewer means the analyzer or the candidates broke.
  if (cases.length < 400) {
    throw new Error(`The analyzer accepts only ${cases.length} pairs of the attribute sweep.`);
  }
  sweep = cases;
  return sweep;
}

/** A typed value the bound sweep binds an attribute to: the prop's type, and its value. */
interface BoundValue {
  type: string;
  value: unknown;
}

const string = (value: string): BoundValue => ({ type: "string", value });
const number = (value: number): BoundValue => ({ type: "number", value });
const boolean = (value: boolean): BoundValue => ({ type: "boolean", value });

/**
 * The values the bound sweep binds an attribute to, one case per entry, each entry's
 * alternatives most specific first (the analyzer takes the first it accepts). Only values the
 * contract covers (ADR-0035, ADR-0037): booleans on bindable boolean attributes (present and
 * absent), booleans on ARIA's and the other `"true"`/`"false"` attributes, numbers in range on
 * number-typed attributes, `about:blank` on URLs (no request, and no scheme a target blocks or
 * prefixes), and a string or a number elsewhere.
 */
function boundSweepValues({ tag, name, namespace }: SweepCandidate): BoundValue[][] {
  // An enumerated attribute is bound to a union of the keywords every typed target accepts: a
  // `string` fails some target's types (UF3018).
  const listed = enumeratedValues(tag, namespace, name);
  // Some take booleans and no keyword (`draggable`).
  const enumerated = listed?.tokens.length ? listed : undefined;
  const union = enumerated?.tokens.map((token) => JSON.stringify(token)).join(" | ");
  const keyword = (value: string): BoundValue => ({ type: union ?? "string", value });
  if (namespace === "svg") {
    if (isNumberTypedAttribute(tag, name)) return [[number(2)]];
    return [enumerated ? [keyword(enumerated.tokens[0]!)] : [string("1"), number(2)]];
  }
  if (isBooleanAttribute(name)) return [[boolean(true)], [boolean(false)]];
  if (TRUE_VALUED_ATTRIBUTES.has(name)) {
    return [
      [boolean(true), keyword("true")],
      [boolean(false), keyword("false")],
    ];
  }
  if (enumerated) return [[keyword(enumerated.tokens[0]!)]];
  if (isNumberTypedAttribute(tag, name)) return [[number(2)]];
  if (URL_ATTRIBUTES.has(name)) return [[string("about:blank")]];
  if (name.endsWith("srcset")) return [[string("about:blank 1x")]];
  if (NUMERIC_ATTRIBUTES.get(tag)?.has(name)) return [[number(2), string("2")]];
  return [[string("x"), number(1)]];
}

let boundSweep: readonly ParityCase[] | undefined;

/**
 * The bound attribute sweep: every (element, attribute) pair the analyzer accepts bound to a
 * prop (`name={value}`), with the values {@link boundSweepValues} gives. A bound attribute takes
 * a path of its own in every target (React's props, Vue's `patchProp`, Svelte's
 * `set_attribute`, Angular's `[attr.x]`, Solid's compiled attribute and property setters), and
 * booleans and numbers render by rules a static value never meets.
 */
export function boundAttributeSweep(): readonly ParityCase[] {
  if (boundSweep) return boundSweep;
  const slots: { key: string; first: number; count: number }[] = [];
  const specs: SourceCase[] = [];
  for (const candidate of sweepCandidates()) {
    if (candidate.name === "class") continue;
    for (const alternatives of boundSweepValues(candidate)) {
      const [{ value: shown }] = alternatives as [BoundValue];
      slots.push({
        key: `${candidate.key} = ${typeof shown === "string" ? JSON.stringify(shown) : String(shown)}`,
        first: specs.length,
        count: alternatives.length,
      });
      for (const { type, value } of alternatives) {
        specs.push({
          name: `${candidate.key} bound to ${type}`,
          params: `{ value }: { value: ${type} }`,
          jsx: `<div>${sweepSource(candidate, ` ${candidate.name}={value}`)}</div>`,
          props: { value },
        });
      }
    }
  }
  const codes = new Map<number, string[]>();
  const lowered = lowerSources(specs, "drop", codes);
  const cases: ParityCase[] = [];
  for (const { key, first, count } of slots) {
    const accepted = lowered.slice(first, first + count).find((each) => each !== undefined);
    if (accepted) cases.push({ ...accepted, name: key });
    else drops.bound.set(key, codes.get(first + count - 1) ?? []);
  }
  if (cases.length < 400) {
    throw new Error(`The analyzer accepts only ${cases.length} pairs of the bound sweep.`);
  }
  boundSweep = cases;
  return boundSweep;
}

let allSuites: readonly ParitySuite[] | undefined;

/**
 * Every suite each target's render-parity tests run: M0's static ones and the attribute sweep;
 * then M1's source components, destructured and read through one object, each root case as a
 * component's root, the seeded random components, and the bound attribute sweep.
 */
export function paritySuites(): readonly ParitySuite[] {
  if (allSuites) return allSuites;
  const tricky = sourceCases(TRICKY_SOURCES);
  const roots = sourceCases([
    ...ROOT_SOURCES,
    ...ROOT_SOURCE_SEEDS.map((seed) => fuzzSource(seed, { root: true })),
  ]);
  const fuzzed = sourceCases(FUZZ_SOURCE_SEEDS.map((seed) => fuzzSource(seed)));
  const objects = sourceCases(
    FUZZ_SOURCE_SEEDS.map((seed) => fuzzSource(seed, { form: "object" })),
  );
  allSuites = [
    ...PARITY_SUITES,
    { title: "the attribute sweep", cases: attributeSweep() },
    { title: "the tricky components", cases: tricky },
    {
      title: "the tricky components, read through a props object",
      form: "object",
      cases: tricky.filter(({ lowered }) => !lowered!.component.props.some((prop) => prop.default)),
    },
    ...roots.map((root): ParitySuite => ({
      title: `the root: ${root.name}`,
      root: "self",
      cases: [root],
    })),
    { title: "seeded random components", cases: fuzzed },
    {
      title: "seeded random components, read through a props object",
      form: "object",
      cases: objects,
    },
    { title: "the bound attribute sweep", cases: boundAttributeSweep() },
  ];
  return allSuites;
}

/** Options for {@link renderParityModules}. */
export interface ParityModulesOptions {
  /**
   * The target whose components to serve. Without one, the manifest lists the suites' cases and
   * no component: the kit's own browser tests read the expected trees from it.
   */
  target?: Target;
  /** The extension of the target's output file, which the framework's Vite plugin claims. */
  extension?: string;
  /**
   * Whether to serve the formatted output besides the printer's layout. The two differ wherever
   * code is formatted: a JSX module, and a `.vue` or `.svelte` file's script block (ADR-0041),
   * though never markup (ADR-0026).
   */
  formatted?: boolean;
  /**
   * Whether to serve each case as a component of its own too. Vue renders a small static
   * template through `patchProp`, which sets some attributes as DOM properties, and a large
   * one through `innerHTML`: only small components take the first path.
   */
  perCase?: boolean;
  /** The suites to serve; by default {@link clientParitySuites}. */
  suites?: readonly ParitySuite[];
}

/**
 * The suites a client renderer must render as the reference describes: all but the carriage
 * returns. The IR holds none (ADR-0030: the analyzer reports one as UF3010), and the printers'
 * escapes for them are checked on the server; Solid's and Svelte's client compiles fold static
 * text and attributes into HTML template strings, whose parsing turns them into line feeds.
 */
export function clientParitySuites(): readonly ParitySuite[] {
  return paritySuites().filter(({ cases }) => cases !== CARRIAGE_RETURN_CASES);
}

/**
 * The module a browser test imports the suites from, which the plugin replaces with the
 * suites and a loader for each component (a real file, so that its types are real).
 */
const MANIFEST = fileURLToPath(new URL("render-parity-manifest.ts", import.meta.url))
  .split(sep)
  .join("/");
/** Where the emitted components live, under the Vite root (no file is ever written there). */
const PARITY_DIRECTORY = "/__uf_render_parity__/";

/** One component the plugin serves. */
interface ServedComponent {
  suite: number;
  format: boolean;
  /** The index of the case it renders alone, or `undefined` when it renders the whole suite. */
  only?: number;
}

/** The suite a served component renders: the whole suite, or one case of it alone. */
function servedSuite(suite: ParitySuite, only: number | undefined): ParitySuite {
  return only === undefined ? suite : { ...suite, cases: [suite.cases[only]!] };
}

/**
 * Serves the parity components to a browser project: ./render-parity-manifest.ts lists the
 * suites, and each component is a module under `/__uf_render_parity__/` with the target's
 * extension, so the framework's own Vite plugin compiles it as it would the unplugin's output.
 */
export function renderParityModules(options: ParityModulesOptions): Plugin {
  const { target, extension = "" } = options;
  const served = new Map<string, ServedComponent>();
  let suites: readonly ParitySuite[] | undefined;
  /** The suites, built when first needed, not whenever the configuration loads. */
  const suitesServed = () => {
    if (suites) return suites;
    suites = options.suites ?? clientParitySuites();
    suites.forEach(({ cases }, suite) => {
      if (!target) return;
      for (const format of options.formatted ? [true, false] : [false]) {
        const base = `${PARITY_DIRECTORY}${suite}-${format ? "formatted" : "printed"}`;
        served.set(`${base}${extension}`, { suite, format });
        if (!options.perCase) continue;
        cases.forEach((_, only) =>
          served.set(`${base}-${only}${extension}`, { suite, format, only }),
        );
      }
    });
    return suites;
  };
  let root = "";
  /** The served path of an id or URL with its query, or `undefined` when it is not one. */
  const servedPath = (id: string) => {
    if (!id.includes(PARITY_DIRECTORY)) return undefined;
    suitesServed();
    const [path = ""] = id.split("?");
    const relative = root && path.startsWith(`${root}/`) ? path.slice(root.length) : path;
    return served.has(relative) ? relative : undefined;
  };

  return {
    name: "uf-render-parity",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    resolveId(source) {
      const path = servedPath(source);
      if (path === undefined) return null;
      // Queries are the framework plugin's requests for parts of the module (`?vue&type=…`).
      const query = source.includes("?") ? source.slice(source.indexOf("?")) : "";
      return `${root}${path}${query}`;
    },
    async load(id) {
      if (id === MANIFEST) return manifest(target, suitesServed(), served);
      if (id.includes("?")) return null;
      const path = servedPath(id);
      if (path === undefined || !target) return null;
      const { suite, format, only } = served.get(path)!;
      const [file, ...rest] = await emitParity(target, servedSuite(suitesServed()[suite]!, only), {
        format,
      });
      if (rest.length || !file?.path.endsWith(extension)) {
        throw new Error(`${target.name} did not emit one ${extension} file.`);
      }
      return file.contents;
    },
  };
}

/**
 * The manifest's code: each suite's cases, with the tree each renders and the capabilities each
 * uses that the target's matrix marks unsupported, and each component with a dynamic import and
 * the props it renders with, written as a JavaScript literal (JSON has no `undefined` or `-0`).
 */
function manifest(
  target: Target | undefined,
  suites: readonly ParitySuite[],
  served: ReadonlyMap<string, ServedComponent>,
): string {
  const components = suites.map(() => [] as string[]);
  for (const [path, { suite, format, only }] of served) {
    const props = jsLiteral(parityProps(servedSuite(suites[suite]!, only)));
    components[suite]!.push(
      `{ format: ${format}, only: ${only ?? "undefined"}, props: ${props}, load: () => import(${JSON.stringify(path)}) }`,
    );
  }
  const entries = suites.map(({ title, root = "div", cases }, suite) => {
    const listed = cases.map((parityCase): ClientCase => ({
      name: parityCase.name,
      expected: expectedTree(parityCase),
      unsupported: target ? unsupportedCapabilities(target, parityCase) : [],
    }));
    return `{ title: ${JSON.stringify(title)}, root: ${JSON.stringify(root)}, cases: ${JSON.stringify(listed)}, components: [${components[suite]!.join(", ")}] }`;
  });
  return `export const suites = [\n${entries.join(",\n")}\n];\n`;
}

/**
 * A value as a JavaScript literal: what JSON writes, and the values JSON cannot (`undefined`,
 * `-0`, `NaN`, the infinities). Props hold only these and plain arrays and objects.
 */
export function jsLiteral(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "number") {
    if (Object.is(value, -0)) return "-0";
    if (Number.isNaN(value)) return "NaN";
    if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
    return String(value);
  }
  if (typeof value === "string" || typeof value === "boolean" || value === null) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(jsLiteral).join(", ")}]`;
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const entries = Object.entries(value).map(
      ([key, item]) => `${JSON.stringify(key)}: ${jsLiteral(item)}`,
    );
    return `{ ${entries.join(", ")} }`;
  }
  throw new Error(`A prop value cannot be a ${typeof value}.`);
}

/** Options for {@link browserProject}. */
export interface BrowserProjectOptions {
  /** Vitest's Playwright provider, from the package's own `@vitest/browser-playwright`. */
  provider: BrowserProviderOption;
  /** The target toolchain's browser configuration (`toolchain.vite("browser", …)`). */
  vite?: ViteUserConfig;
  /** The parity components to serve, for a target package; the cases alone, for the kit's. */
  modules?: ParityModulesOptions;
}

/**
 * A package's `browser` project: its `test/**\/*.browser.test.ts` in headless Chromium, with
 * the target's own Vite plugins and the parity components they compile.
 */
export function browserProject(options: BrowserProjectOptions): TestProjectInlineConfiguration {
  const { provider, vite = {}, modules } = options;
  return {
    ...vite,
    plugins: [...(modules ? [renderParityModules(modules)] : []), ...(vite.plugins ?? [])],
    test: {
      ...vite.test,
      name: "browser",
      include: ["test/**/*.browser.test.ts"],
      browser: {
        enabled: true,
        provider,
        headless: true,
        // Named, or Vitest calls the project "browser (chromium)".
        instances: [{ browser: "chromium", name: "browser" }],
        screenshotFailures: false,
      },
    },
  };
}
