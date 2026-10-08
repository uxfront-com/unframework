// Canaries (plan §7.7): test-only corruptions of a compile (a compiler plugin, mostly) in a way
// one layer exists to catch. `pnpm test:canaries` runs each against the projects that verify
// its layer, with `UF_CANARY=<id>`, and fails unless the run fails with that layer failing on
// every case it corrupts, on every target, with the evidence of every sub-check the canary
// names (`canary-verdict.ts`). A layer that fails because its tool crashed proves nothing, and a
// sub-check that never fails on its own (ARIA behind the DOM, pixels behind geometry, the
// golden files behind the IR snapshot, determinism and formatting behind the golden files, the
// fix check behind the diagnostics, a framework's lint rules behind the baseline rules) is not
// proven by its sibling.
//
// A corruption must reach every case it is judged on and keep the IR valid: the compiler turns a
// plugin that throws or returns IR that breaks an invariant into a UF8001 and emits the module
// as it was, so the layer would fail for the wrong reason, or not at all. So the IR canaries
// change only elements every render shows, with attributes each element takes (an `<svg>` has
// no `hidden`), and replace what an element already sets rather than set it twice;
// `canaries.unit.test.ts` runs each canary on every case of the corpus.
import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import type { OutputFile } from "@unframework/codegen";
import { builtinTargets } from "@unframework/compiler";
import type { CompilerPlugin, TargetName } from "@unframework/compiler";
import type { Diagnostic } from "@unframework/diagnostics";
import {
  createElement,
  createStaticAttribute,
  createStaticStyle,
  createStyleAttribute,
  createText,
  cssPropertiesOverlap,
  elementNamespace,
  isVoidElement,
  PERMITTED_CHILDREN,
  SVG_TEXT_ELEMENTS,
  UNINTERPOLATED_ELEMENTS,
} from "@unframework/ir";
import type {
  Attribute,
  ElementNode,
  FragmentNode,
  Namespace,
  RenderNode,
  StaticAttribute,
  StaticStyle,
  UfModule,
} from "@unframework/ir";
import { REQUIRES_SKIP } from "@unframework/testing/node";
import type { LayerName, ProjectKind } from "@unframework/testing/node";

import { errorState, expectedDiagnostics, specTests } from "./cases.ts";
import type { CaseInfo } from "./cases.ts";
import { ROOT } from "./paths.ts";
import { REFERENCE } from "./targets.ts";

/** What a sub-check's failure says: a pattern, or one built for the target of the cell. */
export type Evidence = RegExp | ((target: string) => RegExp);

/** What the verdict and the compile project know about a case, from its committed artefacts. */
export interface CanaryCase {
  id: string;
  /** Whether the case has output for a target: a case with compile errors has none to corrupt. */
  hasOutput(target: string): boolean;
  /** The browser spec, relative to the integration package, which the browser projects run. */
  spec: string | undefined;
  /** Whether the case's expected diagnostics for a target carry a fix, which L1 applies. */
  hasFixes(target: string): boolean;
  /**
   * Whether a test of the spec runs on a target: it requires no capability the target lacks,
   * so the browser project does not skip it. A browser project proves nothing on a case none
   * of whose tests runs on its target.
   */
  runs(target: string): boolean;
  /** Whether a test that runs on a target acts (`view.user.…`): its traces record actions. */
  interacts(target: string): boolean;
  /** Whether a test that runs on a target rerenders: its traces record rerenders. */
  rerenders(target: string): boolean;
  /** Whether the committed IR has an element listener (an `Event` attribute) to unwire. */
  listens: boolean;
}

/** One canary. */
export interface Canary {
  id: string;
  /** The layer that must catch it. */
  layer: LayerName;
  /** What it corrupts. */
  description: string;
  /**
   * The kinds of project that verify the layer (the runner runs only those) and, for each, the
   * sub-checks that must catch the canary: every pattern must match the layer's failure on
   * every case the project verifies, on every target the canary corrupts.
   */
  evidence: Partial<Record<ProjectKind, Readonly<Record<string, Evidence>>>>;
  /**
   * Kinds of project where the canary fails a spec's import, before any test records a cell
   * (the golden guard in a browser project), and the sub-checks that must catch it there: every
   * pattern must match the error each such project's spec failed to load with, on every case
   * the project verifies. The runner runs these kinds too.
   */
  loadEvidence?: Partial<Record<ProjectKind, Readonly<Record<string, Evidence>>>>;
  /**
   * Corrupts every target but the reference. With live pixels the reference's capture is the
   * expectation, so only a difference between targets is visible; a corruption that every
   * target shares can only be caught against committed baselines.
   */
  followersOnly?: boolean;
  /**
   * The targets it corrupts, when not every one: a corruption of one framework's own code. The
   * runner runs only these targets' projects, and the verdict judges only these.
   */
  targets?: readonly TargetName[];
  /**
   * Leaves the golden guard on. Every other canary turns it off: it changes the output on
   * purpose, and the guard would fail every module before the canary's layer could.
   */
  guard?: boolean;
  /**
   * Corrupts each case's source before the compile project compiles it. It reaches the cases
   * with compile errors, which have no IR or output for a plugin to corrupt. The other projects
   * compile the file on disk, so such a canary names only the compile project.
   */
  source?(text: string): string;
  /**
   * `false`: the compile project compiles without the compiler's format step, as a compiler that
   * stopped formatting would. Only the compile project, too.
   */
  format?: false;
  /** The compiler plugin, made afresh for each compile. */
  plugin?(): CompilerPlugin;
  /**
   * Corrupts a target's diagnostics before the compile project's fix check applies their fixes
   * (L1). No compiler hook reaches the fixes, so the harness corrupts them; a case with compile
   * errors has them too. Only the compile project.
   */
  fixes?(diagnostics: readonly Diagnostic[], source: string, target: string): Diagnostic[];
  /**
   * The cases the canary corrupts on a target, when not every case it can reach: the compile
   * project corrupts, and the verdict judges, only those.
   */
  appliesTo?(info: CanaryCase, target: string): boolean;
}

const MARKER = "[uf canary]";

/** What the text canaries append to a text every render shows. */
const TEXT_MARKER = "(canary)";

/** A golden output file of the cell's own target. */
const goldenFile = (target: string) => `__output__/${target}/\\S+`;

/** The golden guard's failure for a module of the cell's own target. */
const guardFailure = (target: string) =>
  new RegExp(`\\[uf guard\\] The ${target} output of \\S+ is not its golden output`);

/** An idiom a target's lint plugin forbids, as an attribute, and the rule that reports it. */
interface FrameworkRule {
  attribute: string;
  rule: string;
}

/**
 * One idiom each target's lint plugin forbids, written on the root element (ADR-0042): the
 * framework layer of L5, which the baseline rules cannot prove.
 */
const FRAMEWORK_RULES: Readonly<Record<TargetName, FrameworkRule>> = {
  react: { attribute: 'class="uf-canary"', rule: "react/no-unknown-property" },
  vue: { attribute: "v-html=\"'uf-canary'\"", rule: "vue/no-v-html" },
  svelte: {
    attribute: 'style:uf-canary="1"',
    rule: "svelte/no-unknown-style-directive-property",
  },
  solid: { attribute: 'className="uf-canary"', rule: "solid/no-react-specific-props" },
  angular: {
    attribute: '*ngIf="true"',
    rule: "@angular-eslint/template/prefer-control-flow",
  },
  qwik: { attribute: 'className="uf-canary"', rule: "qwik/no-react-props" },
  astro: { attribute: 'set:html="uf-canary"', rule: "astro/no-set-html-directive" },
};

/** How many compiles the L2-nondeterministic canary has numbered in this process. */
let compiles = 0;

/**
 * The events at least one of which every action of `view.user` dispatches on the document: a
 * click, a hover, a key, a field's input, a focus moving, a wheel.
 */
const ACTION_EVENTS = ["click", "pointerover", "keydown", "input", "focusin", "wheel"];

/** Every canary: at least one per live layer, and one per sub-check a sibling could hide. */
export const CANARIES: readonly Canary[] = [
  {
    id: "L1-diagnostic-added",
    layer: "L1",
    description:
      'Prepends `import "react";` to every case\'s source in the compile project: an unexpected UF1201 on every case that parses, and on every diagnostics case its own diagnostics a line further down (a file that does not parse reports its syntax error alone).',
    evidence: {
      compile: {
        // The added UF1201, or, in a file that does not parse, its syntax error a line down.
        diagnostics:
          /__expected__\/diagnostics\.json differs[\s\S]*(?:UF1201|^\+\s+"line": \d+,$)/m,
      },
    },
    source: (text) => `import "react";\n${text}`,
  },
  {
    id: "L1-plugin-throws",
    layer: "L1",
    description: "A compiler plugin whose ir hook throws: an unexpected UF8001 on every target.",
    evidence: {
      compile: { diagnostics: /__expected__\/diagnostics\.json differs[\s\S]*UF8001/ },
    },
    plugin: () => ({
      name: "uf-canary-L1",
      ir() {
        throw new Error(`${MARKER} the ir hook throws`);
      },
    }),
  },
  {
    id: "L1-fix-no-op",
    layer: "L1",
    description:
      "Makes the fixes of the first fixable diagnostic rewrite the source as it was, in the compile project's fix check, on every case whose diagnostics have a fix: applying them leaves the diagnostic, while the diagnostics themselves still match.",
    evidence: {
      compile: { fixes: /Applying the fixes of .+ does not recompile clean/ },
    },
    appliesTo: (info, target) => info.hasFixes(target),
    fixes: (diagnostics, source, target) => {
      const first = diagnostics.findIndex(
        (diagnostic) =>
          (diagnostic.target === undefined || diagnostic.target === target) &&
          diagnostic.fixes?.length,
      );
      if (first === -1) throw new Error(`${MARKER} L1: no diagnostic has a fix to corrupt.`);
      return diagnostics.map((diagnostic, index) =>
        index === first
          ? {
              ...diagnostic,
              fixes: diagnostic.fixes!.map((fix) => ({
                ...fix,
                edits: fix.edits.map((edit) => ({
                  ...edit,
                  text: source.slice(edit.span.start, edit.span.end),
                })),
              })),
            }
          : diagnostic,
      );
    },
  },
  {
    id: "L2-ir-attribute",
    layer: "L2",
    description:
      "Adds an attribute to every component's root in the IR: the IR snapshot and every golden output differ.",
    evidence: {
      compile: {
        "IR snapshot": /__output__\/ir\.json differs/,
        "golden output": (target) => new RegExp(`${goldenFile(target)} differs`),
      },
    },
    plugin: () => ({
      name: "uf-canary-L2-ir",
      ir: (module) =>
        mapRoots(module, (root) => {
          setAttribute(root, createStaticAttribute("data-uf-canary", "L2", root.span));
        }),
    }),
  },
  {
    id: "L2-output-edited",
    layer: "L2",
    description:
      "Adds a declaration to every emitted file and leaves the IR alone: only the golden outputs differ.",
    evidence: {
      compile: { "golden output": (target) => new RegExp(`${goldenFile(target)} differs`) },
    },
    plugin: () => ({
      name: "uf-canary-L2-output",
      output: (files, { target }) =>
        files.map((file) => ({
          ...file,
          contents: injectScript(file, target, `const ufCanaryL2 = "${MARKER}";`, "module"),
        })),
    }),
  },
  {
    id: "L2-nondeterministic",
    layer: "L2",
    description:
      "Numbers each compile in every emitted file, as a counter that is never reset would: compiling a case twice gives different bytes.",
    evidence: { compile: { determinism: /Compiling twice gave different results/ } },
    plugin: () => {
      compiles += 1;
      const declaration = `const ufCanaryCompile = ${compiles};`;
      return {
        name: "uf-canary-L2-nondeterministic",
        output: (files, { target }) =>
          files.map((file) => ({
            ...file,
            contents: injectScript(file, target, declaration, "module"),
          })),
      };
    },
  },
  {
    id: "L2-unformatted",
    layer: "L2",
    description:
      "Compiles without the format step and ends every emitted file with blank lines: formatting the output again changes it.",
    evidence: {
      compile: {
        "formatting idempotence": (target) =>
          new RegExp(`${target}/\\S+ is not formatted idempotently`),
      },
    },
    format: false,
    plugin: () => ({
      name: "uf-canary-L2-unformatted",
      output: (files) => files.map((file) => ({ ...file, contents: `${file.contents}\n\n` })),
    }),
  },
  {
    id: "L3-mismatched-closing-tag",
    layer: "L3",
    description:
      "Renames the last closing tag of every output's template (`</p>` → `</span>`): the one corruption all seven framework compilers reject (the framework-compile ADR).",
    evidence: {
      // `<file>: error <the framework compiler's message>`, on the case's own output file.
      toolchain: { "framework compiler": (target) => new RegExp(`${goldenFile(target)}: error `) },
    },
    plugin: () => ({
      name: "uf-canary-L3",
      output: (files) => files.map((file) => ({ ...file, contents: mismatchClosingTag(file) })),
    }),
  },
  {
    id: "L4-type-error",
    layer: "L4",
    description: 'Adds `const …: number = "…"` in each output\'s own script syntax.',
    evidence: {
      // TS2322, in every checker's words, on the case's own output file.
      toolchain: {
        "type checker": (target) =>
          new RegExp(`${goldenFile(target)}: .*not assignable to type 'number'`),
      },
    },
    plugin: () => ({
      name: "uf-canary-L4",
      output: (files, { target }) =>
        files.map((file) => ({
          ...file,
          contents: injectScript(
            file,
            target,
            `const ufCanaryTypeError: number = "${MARKER} L4";`,
            "module",
          ),
        })),
    }),
  },
  {
    id: "L5-debugger",
    layer: "L5",
    description:
      "Adds `debugger;` where every component renders: the baseline rules every target's oxlint shares (`no-debugger`) report it.",
    evidence: {
      // `<file>: <rule> <message>`, on the case's own output file.
      toolchain: {
        "baseline rules": (target) => new RegExp(`${goldenFile(target)}: no-debugger `),
      },
    },
    plugin: () => ({
      name: "uf-canary-L5-debugger",
      output: (files, { target }) =>
        files.map((file) => ({
          ...file,
          contents: injectScript(file, target, "debugger;", "render"),
        })),
    }),
  },
  {
    id: "L5-framework-rule",
    layer: "L5",
    description:
      "Writes on every output's root element an idiom its framework's lint plugin forbids: `class` in React, `className` in Solid and Qwik, `v-html`, a style directive for no property, `*ngIf`, `set:html`.",
    evidence: {
      toolchain: {
        "framework rules": (target) =>
          new RegExp(`${goldenFile(target)}: ${escapeRegExp(frameworkRule(target).rule)} `),
      },
    },
    plugin: () => ({
      name: "uf-canary-L5-framework-rule",
      output: (files, { target }) =>
        files.map((file) => ({
          ...file,
          contents: addRootAttribute(file, frameworkRule(target).attribute),
        })),
    }),
  },
  {
    id: "L6-wrong-text",
    layer: "L6",
    description:
      "Appends a marker to the text of an element every render of every component shows: the server HTML differs.",
    evidence: { ssr: { "server HTML": /__expected__\/ssr\.[a-z0-9-]+\.html differs/ } },
    plugin: wrongText,
  },
  {
    id: "L6-golden-guard",
    layer: "L6",
    description:
      "Adds a declaration to every emitted file, which renders the same, with the golden guard on: the guard fails each module, so L6 cannot render it and no browser spec can import it.",
    // The server render records the guard's failure on L6. In a browser project the guard fails
    // the spec's import, before any test records a cell: the spec's load error is the evidence.
    evidence: { ssr: { "golden guard": guardFailure } },
    loadEvidence: { browser: { "golden guard": guardFailure } },
    guard: true,
    plugin: () => ({
      name: "uf-canary-guard",
      output: (files, { target }) =>
        files.map((file) => ({
          ...file,
          contents: injectScript(file, target, `const ufCanaryGuard = "${MARKER}";`, "module"),
        })),
    }),
  },
  {
    id: "L7-wrong-text",
    layer: "L7",
    description:
      "Appends a marker to the text of an element every render of every component shows: the client DOM and its ARIA tree differ.",
    evidence: {
      browser: {
        DOM: /__expected__\/dom\.[a-z0-9-]+\.html differs/,
        "ARIA tree": /__expected__\/aria\.[a-z0-9-]+\.yaml differs/,
      },
    },
    plugin: wrongText,
  },
  {
    id: "L8-render-nothing",
    layer: "L8",
    description:
      "Replaces every component's render with an empty <div> and drops its setup, keeping its props and its events (their bindings) so the IR stays valid and the outputs still declare what a mount listens to: every spec's assertions about what it rendered, and its first action, find nothing (ADR-0043, ADR-0050).",
    evidence: {
      // The first positive assertion of a spec, on a query of the view (`getByTestId` is the
      // mount root's locator): every spec makes one (the spec rules in the README). Vitest
      // 5.0.3 reports a locator that never matches with that locator, or, when the poll's own
      // deadline comes first, with the poll's timeout. A spec whose first statement after its
      // first expectParity acts fails with Playwright's action timeout, naming the locator.
      browser: {
        "spec assertions":
          /^(?:VitestBrowserElementError: Cannot find element with locator: getByTestId\('uf-root-\d+'\)\.getBy[A-Za-z]+\(|Error: expect\.poll\(\) function didn't resolve in time\.$|TimeoutError: locator\.[A-Za-z]+: Timeout \d+ms exceeded\.\nCall log:\n {2}- waiting for .*getByTestId\('uf-root-\d+'\)\.getBy[A-Za-z]+\()/m,
      },
    },
    plugin: () => ({
      name: "uf-canary-L8",
      ir: (module) => {
        const copy = structuredClone(module);
        for (const component of copy.components) {
          component.render = createElement("div", [], [], component.render.span);
          // A loop variable is bound by its list, which is gone, and a setup binding by its
          // setup. The events stay declared: Angular's adapter binds each to its output, which
          // must exist, and Vue's would pass an undeclared listener on to the root.
          component.setup = [];
          component.bindings = component.bindings.filter(
            ({ kind }) => kind === "prop" || kind === "emit",
          );
        }
        return copy;
      },
    }),
  },
  {
    id: "L9-unwired-handler",
    layer: "L9",
    description:
      "Removes every element listener from every component on every target but the reference, on the cases whose specs act: each action's step differs from the trace in its DOM or its events.",
    evidence: { browser: { trace: /__expected__\/trace\.[a-z0-9-]+\.json differs/ } },
    // The reference keeps its handlers, as the trace every follower is compared with does.
    followersOnly: true,
    appliesTo: (info, target) => info.interacts(target) && info.listens,
    plugin: () => ({
      name: "uf-canary-L9-unwired",
      ir: (module) => {
        const copy = structuredClone(module);
        for (const { render } of copy.components) unwire(render);
        return copy;
      },
    }),
  },
  {
    id: "L9-rerender-text",
    layer: "L9",
    description:
      "Appends a marker to the text every render shows, on the cases whose specs rerender: each rerender's step differs from the trace, on the cases L9-unwired-handler cannot reach.",
    evidence: { browser: { trace: /__expected__\/trace\.[a-z0-9-]+\.json differs/ } },
    appliesTo: (info, target) => info.rerenders(target),
    plugin: wrongText,
  },
  {
    id: "L10-root-hidden",
    layer: "L10",
    description:
      "Hides every component's root (`display: none`) on every target but the reference: the geometry differs from the reference's, live or committed.",
    evidence: { browser: { geometry: /geometry-mismatch \(/ } },
    followersOnly: true,
    // A declaration, not `hidden`: an `<svg>` takes no `hidden`, and a root's own `display`
    // would override it (bindings/style-merge).
    plugin: () => ({
      name: "uf-canary-L10-geometry",
      ir: (module) =>
        mapRoots(module, (root) => {
          setStyle(root, createStaticStyle("display", "none", root.span));
        }),
    }),
  },
  {
    id: "L10-root-inverted",
    layer: "L10",
    description:
      "Inverts the colours of every component's root on every target but the reference, with a style no geometry property captures: only the pixels differ.",
    evidence: { browser: { pixels: /pixel-mismatch \(/ } },
    followersOnly: true,
    plugin: () => ({
      name: "uf-canary-L10-pixels",
      ir: (module) =>
        mapRoots(module, (root) => {
          setStyle(root, createStaticStyle("filter", "invert(1)", root.span));
        }),
    }),
  },
  {
    id: "L11-invalid-role",
    layer: "L11",
    description: "Gives every component's root an invalid ARIA role: axe-core reports aria-roles.",
    evidence: { browser: { "axe-core": /axe-core violations differ[\s\S]*\baria-roles\b/ } },
    plugin: () => ({
      name: "uf-canary-L11",
      ir: (module) =>
        mapRoots(module, (root) => {
          setAttribute(root, createStaticAttribute("role", "uf-canary", root.span));
        }),
    }),
  },
  {
    id: "L13-console-warn",
    layer: "L13",
    description:
      "Calls console.warn in every target's render path: the function body, component$, <script setup>, the instance script, the constructor, the Astro frontmatter.",
    // The canary's warning, under each capture's own heading.
    evidence: {
      ssr: {
        "server render console":
          /console message\(s\) during the server render:(?:\n {2}.*)*?\n {2}console\.warn: \[uf canary\] L13 /,
      },
      browser: {
        "page console":
          /unexpected console message\(s\):(?:\n {2}.*)*?\n {2}console\.warn(?: \(server render\))?: \[uf canary\] L13 /,
      },
    },
    plugin: () => ({
      name: "uf-canary-L13",
      output: (files, { target }) =>
        files.map((file) => ({
          ...file,
          contents: injectScript(
            file,
            target,
            `console.warn("${MARKER} L13 in ${target}");`,
            "render",
          ),
        })),
    }),
  },
  {
    id: "L13-qwik-handler-throws",
    layer: "L13",
    description:
      "Gives every Qwik component a document listener, for the events every action dispatches, that throws: nothing the component renders or does changes, and only Qwik's report of the error on the console (`QWIK ERROR`) shows it, on the cases whose specs act. Qwik's test mode (`qTest`) would silence the report.",
    // Qwik's development build may also mark the component as errored, which L7 can see; the
    // verdict asks L13 alone for its evidence.
    evidence: {
      browser: {
        "page console":
          /unexpected console message\(s\):(?:\n {2}.*)*?\n {2}console\.error: QWIK ERROR \[uf canary\] L13 /,
      },
    },
    targets: ["qwik"],
    appliesTo: (info, target) => info.interacts(target),
    plugin: () => ({
      name: "uf-canary-L13-qwik-handler",
      output: (files, { target }) =>
        target !== "qwik"
          ? undefined
          : files.map((file) => ({
              ...file,
              contents: injectScript(
                { ...file, contents: withQwikImports(file, ["$", "useOnDocument"]) },
                target,
                `useOnDocument(${JSON.stringify(ACTION_EVENTS)}, $(() => { throw new Error("${MARKER} L13 in ${target}"); }));`,
                "render",
              ),
            })),
    }),
  },
];

/** The canary with an id; throws for an unknown one, so a typo never runs a clean suite. */
export function findCanary(id: string): Canary {
  const canary = CANARIES.find((candidate) => candidate.id === id);
  if (!canary) {
    throw new Error(
      `Unknown canary "${id}". The canaries are: ${CANARIES.map(({ id }) => id).join(", ")}.`,
    );
  }
  return canary;
}

/** The kinds of project that verify a canary: the ones its evidence names, cells or loads. */
export function canaryProjects(canary: Canary): ProjectKind[] {
  return [
    ...new Set([...Object.keys(canary.evidence), ...Object.keys(canary.loadEvidence ?? {})]),
  ] as ProjectKind[];
}

/**
 * The compiler plugins of a run: the canary's, or none. `target` is the target a project
 * compiles to; a canary that spares the reference needs it.
 */
export function canaryPlugins(id: string | null, target?: string): CompilerPlugin[] {
  if (!id) return [];
  const canary = findCanary(id);
  if (!canary.plugin) return [];
  if (target !== undefined && !corrupts(canary, target)) return [];
  if (!canary.followersOnly) return [canary.plugin()];
  if (target === undefined) {
    throw new Error(
      `The ${id} canary spares the reference target, so it needs the project's target.`,
    );
  }
  return target === REFERENCE ? [] : [canary.plugin()];
}

/** Whether a canary corrupts a target: every one, unless it names its targets. */
export function corrupts(canary: Canary, target: string): boolean {
  return !canary.targets || (canary.targets as readonly string[]).includes(target);
}

/** A case's source as the compile project compiles it: corrupted by a source canary. */
export function canarySource(id: string | null, text: string): string {
  const canary = id ? findCanary(id) : undefined;
  return canary?.source ? canary.source(text) : text;
}

/**
 * A target's diagnostics as the compile project's fix check applies them: with their fixes
 * corrupted by a fix canary, on the cases it applies to.
 */
export function canaryFixes(
  id: string | null,
  info: CanaryCase,
  target: string,
  source: string,
  diagnostics: readonly Diagnostic[],
): readonly Diagnostic[] {
  const canary = id ? findCanary(id) : undefined;
  if (!canary?.fixes || (canary.appliesTo && !canary.appliesTo(info, target))) return diagnostics;
  return canary.fixes(diagnostics, source, target);
}

/** Whether the compile project formats its output: always, except under a format canary. */
export function canaryFormats(id: string | null): boolean {
  return !id || findCanary(id).format !== false;
}

/** Whether a run keeps the golden guard on: always, except under a canary that changes outputs. */
export function guardsGoldens(id: string | null): boolean {
  return !id || findCanary(id).guard === true;
}

/** A case of the corpus as canaries see it: what its committed artefacts say. */
export function canaryCase(info: CaseInfo): CanaryCase {
  const tests = info.spec ? specTests(readFileSync(info.spec, "utf8")) : [];
  const ir = join(info.dir, "__output__", "ir.json");
  /** The tests of the spec that run on a target, as the browser project's setup decides. */
  const running = (target: string) =>
    tests.filter((test) => test.requires.every((name) => supports(target, name)));
  return {
    id: info.id,
    hasOutput: (target) => errorState(info, target) === false,
    spec: info.spec && relative(ROOT, info.spec).split(sep).join("/"),
    hasFixes: (target) =>
      (expectedDiagnostics(info) ?? []).some(
        (diagnostic) =>
          (diagnostic.target === undefined || diagnostic.target === target) &&
          Boolean(diagnostic.fixes?.length),
      ),
    runs: (target) => running(target).length > 0,
    interacts: (target) => running(target).some((test) => test.acts),
    rerenders: (target) => running(target).some((test) => test.rerenders),
    listens: existsSync(ir) && listens(JSON.parse(readFileSync(ir, "utf8")) as UfModule),
  };
}

/**
 * Whether a target supports a capability a test requires: the browser setup skips the test
 * where the cell is unsupported (`requiredSkip` in `@unframework/testing`). Throws for a name
 * that is no capability, as the setup does.
 */
function supports(target: string, capability: string): boolean {
  const targets: Readonly<
    Record<string, { capabilities: Readonly<Record<string, { support: string }>> } | undefined>
  > = builtinTargets;
  const cells: Readonly<Record<string, { support: string } | undefined>> =
    targets[target]?.capabilities ?? {};
  const cell = Object.hasOwn(cells, capability) ? cells[capability] : undefined;
  if (!cell) throw new Error(`${MARKER} "${capability}" is not a capability of ${target}.`);
  return cell.support !== "unsupported";
}

/** Whether a module's render trees have an element listener. */
function listens(module: UfModule): boolean {
  return module.components.some(({ render }) => elementsOf([render]).some(hasListener));
}

function hasListener(element: ElementNode): boolean {
  return element.attributes.some((attribute) => attribute.kind === "Event");
}

/** Every element of a render tree, through branches and lists. */
function elementsOf(nodes: readonly (RenderNode | FragmentNode)[]): ElementNode[] {
  return nodes.flatMap((node): ElementNode[] => {
    switch (node.kind) {
      case "Element":
        return [node, ...elementsOf(node.children)];
      case "Fragment":
        return elementsOf(node.children);
      case "If":
        return node.branches.flatMap((branch) => elementsOf(branch.children));
      case "For":
        return elementsOf([node.body]);
      case "Text":
      case "Interpolation":
        return [];
      default:
        return unreachable(node);
    }
  });
}

/** Removes every element listener of a render tree, in place: its handlers never run. */
function unwire(render: ElementNode | FragmentNode): void {
  for (const element of elementsOf([render])) {
    element.attributes = element.attributes.filter((attribute) => attribute.kind !== "Event");
  }
}

/** Whether a cell is a skip by a capability the target lacks, which no canary can corrupt. */
export function skippedByCapability(cell: string): boolean {
  const reason = /^skip\((.*)\)$/s.exec(cell)?.[1];
  return reason !== undefined && REQUIRES_SKIP.test(reason);
}

/** The idiom the L5-framework-rule canary writes for a target; throws for an unknown one. */
function frameworkRule(target: string): FrameworkRule {
  const rules: Readonly<Record<string, FrameworkRule | undefined>> = FRAMEWORK_RULES;
  const rule = rules[target];
  if (!rule) throw new Error(`${MARKER} L5: no framework rule for the ${target} target.`);
  return rule;
}

function wrongText(): CompilerPlugin {
  return {
    name: "uf-canary-wrong-text",
    ir: (module) => {
      const copy = structuredClone(module);
      for (const { name, render } of copy.components) {
        if (!markText(render)) {
          throw new Error(`${MARKER} ${name} renders no element that can hold text.`);
        }
      }
      return copy;
    },
  };
}

/**
 * Appends the marker to the text of one element that every render shows: the first element,
 * from the roots down through elements, never into a branch or a list, that can hold text. A
 * root fragment whose roots all sit in branches or lists gets one in each of them. Returns
 * whether it marked any.
 */
function markText(render: ElementNode | FragmentNode): boolean {
  const always =
    render.kind === "Element"
      ? [render]
      : render.children.filter((node): node is ElementNode => node.kind === "Element");
  for (const root of always) {
    const holder = textHolder(root, "html");
    if (holder) {
      appendMarker(holder);
      return true;
    }
  }
  let marked = false;
  for (const root of rootElements(render)) {
    const holder = textHolder(root, "html");
    if (holder) {
      appendMarker(holder);
      marked = true;
    }
  }
  return marked;
}

/**
 * The first element, the element itself or one of its descendants through elements, that can
 * hold text: its text renders, in the server HTML, the DOM and the ARIA tree, as every target
 * renders it. Never a void or text-free HTML element, a `<textarea>`, or an SVG element that
 * renders no text.
 */
function textHolder(element: ElementNode, parent: Namespace): ElementNode | undefined {
  const namespace = elementNamespace(element.tag, parent);
  const holds =
    namespace === "svg"
      ? SVG_TEXT_ELEMENTS.has(element.tag)
      : !isVoidElement(element.tag) &&
        !UNINTERPOLATED_ELEMENTS.has(element.tag) &&
        !PERMITTED_CHILDREN.has(element.tag);
  if (holds) return element;
  for (const child of element.children) {
    if (child.kind !== "Element") continue;
    const holder = textHolder(child, namespace);
    if (holder) return holder;
  }
  return undefined;
}

/**
 * Appends the marker as the element's last text, merged into a text it ends with: no two texts
 * are adjacent in the IR.
 */
function appendMarker(element: ElementNode): void {
  const last = element.children.at(-1);
  if (last?.kind === "Text") {
    last.value = `${last.value} ${TEXT_MARKER}`;
    return;
  }
  const value = element.children.length ? ` ${TEXT_MARKER}` : TEXT_MARKER;
  element.children.push(createText(value, element.span));
}

/**
 * A copy of the module with `change` applied to each component's root elements: the root, or
 * each element among the roots of a root fragment, with those of its branches and list bodies.
 */
function mapRoots(module: UfModule, change: (root: ElementNode) => void): UfModule {
  const copy = structuredClone(module);
  for (const { render } of copy.components) {
    for (const root of rootElements(render)) change(root);
  }
  return copy;
}

/** A component's root elements: the root, or the elements among a root fragment's roots. */
function rootElements(render: ElementNode | FragmentNode): ElementNode[] {
  return render.kind === "Element" ? [render] : topElements(render.children);
}

/** The elements among some roots, through branches and list bodies. */
function topElements(nodes: readonly RenderNode[]): ElementNode[] {
  return nodes.flatMap((node): ElementNode[] => {
    switch (node.kind) {
      case "Element":
        return [node];
      case "If":
        return node.branches.flatMap((branch) => topElements(branch.children));
      case "For":
        return [node.body];
      case "Text":
      case "Interpolation":
        return [];
      default:
        return unreachable(node);
    }
  });
}

/**
 * Sets a static attribute on an element, in place of any it sets already: an attribute of that
 * name, or a spread's key (a spread left without keys goes), since the IR sets a name once.
 */
function setAttribute(element: ElementNode, attribute: StaticAttribute): void {
  element.attributes = element.attributes.flatMap((existing): Attribute[] => {
    if (existing.kind === "Spread") {
      const keys = existing.keys.filter((key) => key.name !== attribute.name);
      return keys.length ? [{ ...existing, keys }] : [];
    }
    return (existing.kind === "Static" || existing.kind === "Bound") &&
      existing.name === attribute.name
      ? []
      : [existing];
  });
  element.attributes.push(attribute);
}

/**
 * Adds a declaration to an element's `style`, in place of any that sets the same property or
 * overlaps it (the IR's styles never do), or gives the element a `style` of its own.
 */
function setStyle(element: ElementNode, declaration: StaticStyle): void {
  const style = element.attributes.find((attribute) => attribute.kind === "Style");
  if (!style) {
    element.attributes.push(createStyleAttribute([declaration], element.span));
    return;
  }
  style.declarations = style.declarations.filter(
    ({ property }) => !cssPropertiesOverlap(property, declaration.property),
  );
  style.declarations.push(declaration);
}

function unreachable(value: never): never {
  throw new Error(`${MARKER} an IR node of an unknown kind: ${JSON.stringify(value)}`);
}

/**
 * Renames the last closing tag of an output's template so it no longer matches its opening
 * tag: a tag of the markup, never one of a script block, and the end of an element rather
 * than text in an attribute value that reads like a tag.
 */
export function mismatchClosingTag(file: OutputFile): string {
  const { path, contents } = file;
  const range = templateRange(path, contents);
  if (!range) throw new Error(`${MARKER} L3: ${path} has no template to find a closing tag in.`);
  let last: RegExpExecArray | undefined;
  const closing = /<\/([A-Za-z][A-Za-z0-9-]*)\s*>/g;
  closing.lastIndex = range.start;
  for (let match = closing.exec(contents); match; match = closing.exec(contents)) {
    if (match.index + match[0].length > range.end) break;
    last = match;
  }
  if (!last) throw new Error(`${MARKER} L3: ${path} has no closing tag to mismatch.`);
  const replacement = last[1] === "span" ? "div" : "span";
  return `${contents.slice(0, last.index)}</${replacement}>${contents.slice(last.index + last[0].length)}`;
}

/**
 * Adds an attribute, written in the file's own syntax, to the root element of an output file:
 * the first element of its template.
 */
export function addRootAttribute(file: OutputFile, attribute: string): string {
  const { path, contents } = file;
  const range = templateRange(path, contents);
  if (!range) {
    throw new Error(`${MARKER} ${path} has no template to find the root element in.`);
  }
  // An element's name is followed by a space, `/` or `>`: `<svelte:options` is not one, nor is
  // a fragment's `<>`.
  const element = /<(?!(?:script|style|template)\b)[A-Za-z][A-Za-z0-9-]*(?=[\s/>])/g;
  element.lastIndex = range.start;
  const match = element.exec(contents);
  if (!match || match.index >= range.end) {
    throw new Error(`${MARKER} ${path} has no root element to add an attribute to.`);
  }
  const end = match.index + match[0].length;
  return `${contents.slice(0, end)} ${attribute}${contents.slice(end)}`;
}

/**
 * Where an output file's template is, in each target's own syntax: after the component's
 * `return` in JSX, inside `template:` in an Angular class, inside the outer `<template>` in Vue,
 * after the options and script blocks in Svelte and after the frontmatter in Astro. Script
 * blocks and frontmatter come first, and their TypeScript has tags of its own (`Array<string>`).
 */
function templateRange(path: string, contents: string): { start: number; end: number } | undefined {
  const end = contents.length;
  if (path.endsWith(".tsx")) {
    const body = componentBodyStart(contents);
    if (body === undefined) return undefined;
    // The component's own `return` gives JSX; a nested function's (`return new Promise<string>`)
    // must not be taken for it, or its type argument would be taken for the root element.
    const returned = /\breturn\s*(?:\(\s*)?(?=<[A-Za-z>])/g;
    returned.lastIndex = body;
    const start = endOf(returned.exec(contents));
    return start === undefined ? undefined : { start, end };
  }
  if (path.endsWith(".ts")) {
    const start = endOf(/\btemplate:\s*`/.exec(contents));
    if (start === undefined) return undefined;
    const close = endOfString(contents, start - 1);
    return close === undefined ? undefined : { start, end: close };
  }
  if (path.endsWith(".vue")) {
    const start = endOf(/<template>/.exec(contents));
    const close = contents.lastIndexOf("</template>");
    return start === undefined || close < start ? undefined : { start, end: close };
  }
  if (path.endsWith(".svelte")) {
    const blocks = [...contents.matchAll(/<\/script\s*>/g)];
    const last = blocks.at(-1);
    return { start: last ? last.index + last[0].length : 0, end };
  }
  if (path.endsWith(".astro")) {
    if (!contents.startsWith("---\n")) return { start: 0, end };
    const start = endOf(/\n---\n/.exec(contents));
    return start === undefined ? undefined : { start, end };
  }
  return undefined;
}

function endOf(match: RegExpExecArray | null): number | undefined {
  return match ? match.index + match[0].length : undefined;
}

/**
 * Adds a statement to an output file in the target's own script syntax. `module` puts it at the
 * top level of the module script; `render` puts it where the component renders, so it runs on
 * every render, on the server and in the browser.
 */
export function injectScript(
  file: OutputFile,
  target: string,
  statement: string,
  where: "module" | "render",
): string {
  const { path, contents } = file;
  const fail = (shape: string): never => {
    throw new Error(`${MARKER} ${path} (${target}) has no ${shape} to inject into.`);
  };
  if (path.endsWith(".vue"))
    return intoScriptBlock(
      contents,
      statement,
      /<script\b[^>]*\bsetup\b[^>]*>/,
      '<script setup lang="ts">',
    );
  if (path.endsWith(".svelte"))
    return intoScriptBlock(
      contents,
      statement,
      /<script\b(?![^>]*\bmodule\b)[^>]*>/,
      '<script lang="ts">',
    );
  if (path.endsWith(".astro")) {
    return contents.startsWith("---\n")
      ? `---\n${statement}\n${contents.slice(4)}`
      : `---\n${statement}\n---\n${contents}`;
  }
  if (where === "module") return `${contents.trimEnd()}\n\nexport ${statement}\n`;
  if (target === "angular") {
    // The constructor runs once per render: an existing one's body gets the statement first,
    // before the effects and hooks it registers (M2's outputs have one).
    const existing = insertAfter(contents, /\bconstructor\s*\([^)]*\)\s*\{/, `\n    ${statement}`);
    if (existing !== undefined) return existing;
    // The class's members follow: a constructor before them still runs once per render.
    return (
      insertAfter(
        contents,
        /export\s+(?:default\s+)?class\s+\w+[^{]*\{/,
        `\n  constructor() {\n    ${statement}\n  }\n`,
      ) ?? fail("component class")
    );
  }
  const body = componentBodyStart(contents);
  if (body === undefined) {
    return fail(target === "qwik" ? "component$ body" : "component function body");
  }
  return `${contents.slice(0, body)}\n  ${statement}${contents.slice(body)}`;
}

/**
 * A Qwik output whose value import from `@qwik.dev/core` also names `names`: each one it lacks
 * is added to it, so the canary's code can call it.
 */
export function withQwikImports(file: OutputFile, names: readonly string[]): string {
  const { path, contents } = file;
  const declaration = /^import \{([^}]*)\} from "@qwik\.dev\/core";$/m.exec(contents);
  if (!declaration) {
    throw new Error(`${MARKER} ${path} (qwik) has no value import from "@qwik.dev/core".`);
  }
  const specifiers = declaration[1]!
    .split(",")
    .map((specifier) => specifier.trim())
    .filter(Boolean);
  const imported = new Set(specifiers.map((specifier) => specifier.split(/\s+as\s+/).at(-1)));
  const added = [...specifiers, ...names.filter((name) => !imported.has(name))];
  return `${contents.slice(0, declaration.index)}import { ${added.join(", ")} } from "@qwik.dev/core";${contents.slice(declaration.index + declaration[0].length)}`;
}

/**
 * Where a JSX component's body starts, just after its `{`: Qwik's `component$<Props>((…) => {`,
 * or the first PascalCase `function Name(…) {` (React and Solid). The parameters are read to
 * their matching parenthesis: a destructured default or a type may hold parentheses of its own.
 */
function componentBodyStart(contents: string): number | undefined {
  // Not the import's `component$`: the call's, with its type argument or its parenthesis.
  const qwik = /\bcomponent\$\s*(?=[<(])/.exec(contents);
  if (qwik) {
    let index = qwik.index + qwik[0].length;
    if (contents[index] === "<") {
      const close = matchingBracket(contents, index, "<", ">");
      if (close === undefined) return undefined;
      index = close + 1;
    }
    const call = /^\s*\(\s*/.exec(contents.slice(index));
    if (!call) return undefined;
    index += call[0].length;
    if (contents[index] !== "(") return undefined;
    const close = matchingBracket(contents, index, "(", ")");
    if (close === undefined) return undefined;
    return endAt(contents, close + 1, /^\s*=>\s*\{/);
  }
  const component = /\bfunction\s+[A-Z][\w$]*\s*\(/.exec(contents);
  if (!component) return undefined;
  const close = matchingBracket(contents, component.index + component[0].length - 1, "(", ")");
  if (close === undefined) return undefined;
  return endAt(contents, close + 1, /^[^{]*\{/);
}

/** The end of `pattern` (anchored with `^`) matched at `index`, or `undefined`. */
function endAt(contents: string, index: number, pattern: RegExp): number | undefined {
  const match = pattern.exec(contents.slice(index));
  return match ? index + match[0].length : undefined;
}

/**
 * The index of the bracket that closes the one at `open`, skipping string and template
 * literals; an arrow's `=>` closes no angle bracket.
 */
function matchingBracket(
  contents: string,
  open: number,
  opening: string,
  closing: string,
): number | undefined {
  let depth = 0;
  for (let index = open; index < contents.length; index += 1) {
    const char = contents[index]!;
    if (char === '"' || char === "'" || char === "`") {
      const end = endOfString(contents, index);
      if (end === undefined) return undefined;
      index = end;
    } else if (char === opening) {
      depth += 1;
    } else if (char === closing && !(char === ">" && contents[index - 1] === "=")) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return undefined;
}

/** The index of the quote that ends the string or template literal opened at `open`. */
function endOfString(contents: string, open: number): number | undefined {
  const quote = contents[open]!;
  for (let index = open + 1; index < contents.length; index += 1) {
    if (contents[index] === "\\") index += 1;
    else if (contents[index] === quote) return index;
  }
  return undefined;
}

function intoScriptBlock(
  contents: string,
  statement: string,
  opening: RegExp,
  create: string,
): string {
  return (
    insertAfter(contents, opening, `\n${statement}`) ??
    `${create}\n${statement}\n</script>\n\n${contents}`
  );
}

function insertAfter(contents: string, pattern: RegExp, text: string): string | undefined {
  const match = pattern.exec(contents);
  if (!match) return undefined;
  const end = match.index + match[0].length;
  return `${contents.slice(0, end)}${text}${contents.slice(end)}`;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
