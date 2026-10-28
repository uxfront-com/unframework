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

import { parseStatementsSource } from "@unframework/codegen";
import type { OutputFile, ParsedStatements } from "@unframework/codegen";
import { builtinTargets } from "@unframework/compiler";
import type { CompilerPlugin, OutputHookContext, TargetName } from "@unframework/compiler";
import type { Diagnostic } from "@unframework/diagnostics";
import {
  childrenOf,
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
  DynamicNode,
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
import { consumerFixtures } from "./consumers.ts";
import { standInCases } from "./no-output.ts";
import { ROOT } from "./paths.ts";
import { QUARANTINE } from "./quarantine.ts";
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
  /** Whether a source's committed IR has an element listener (an `Event` attribute) to unwire. */
  listens: boolean;
  /**
   * Whether the target's browser projects serve the case's spec a stand-in, since the target
   * cannot compile the case yet (ADR-0068): the corrupted component never loads there, so its
   * spec's import proves nothing, as a quarantined cell proves nothing. Absent: never.
   */
  standIn?(target: string): boolean;
  /** Whether a source's committed IR imports a stylesheet, so its compile emits a scoped sheet. */
  styled: boolean;
  /**
   * The target that writes the case's shared artefacts (ADR-0057): a canary that spares the
   * reference spares it there.
   */
  reference: string;
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
   * `true`: the plugin's output hook sees the scoped sheets too (ADR-0063). Every other canary's
   * hook sees a styled component's own files only (`keepingSheets`).
   */
  sheets?: true;
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
        // A case of several sources has a snapshot of each (ADR-0057): the first that differs.
        "IR snapshot": /__output__\/ir(?:\.[A-Za-z0-9]+)?\.json differs/,
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
    id: "L4-consumer",
    layer: "L4",
    description:
      "Types every output's props, events and slots `any`, where its consumers' checker reads them: each consumer fixture's expected error goes unmet (ADR-0059).",
    evidence: {
      // A directive the checker no longer meets, named with the declaration's line: in a
      // `.uf.tsx`, or in a `.ts` module for a type re-exported from one (ADR-0068).
      toolchain: {
        "consumer check":
          /consumers\/\S+:\d+: expected \S+ for \S+ \(\S+\.(?:uf\.tsx|ts):\d+\), got none/,
      },
    },
    appliesTo: (info, target) => consumerFixtures(target, info.id).length > 0,
    // An output hook: the compiler rejects an `ir` hook's type that the analyser did not
    // produce (P2), and props cannot be `any` in the source until M5 (UF1002).
    plugin: () => ({
      name: "uf-canary-L4-consumer",
      output: (files, { target }) =>
        files.map((file) => ({ ...file, contents: widenPublicTypes(file, target) })),
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
    // Each file declares its own name: the unplugin joins the outputs of one `.uf.tsx` into one
    // module for a script target, and rejects a name two of them declare before the guard runs.
    plugin: () => ({
      name: "uf-canary-guard",
      output: (files, { target }) =>
        files.map((file) => ({
          ...file,
          contents: injectScript(
            file,
            target,
            `const ufCanaryGuard_${file.path.replace(/\W/g, "_")} = "${MARKER}";`,
            "module",
          ),
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
          // must exist, and Vue's would pass an undeclared listener on to the root. So do the
          // slots, whose declaration names its binding.
          component.setup = [];
          component.bindings = component.bindings.filter(
            ({ kind }) => kind === "prop" || kind === "emit" || kind === "slots",
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
      "Inverts most of the colours of every component's root on every target but the reference, with a style no geometry property captures: only the pixels differ.",
    evidence: { browser: { pixels: /pixel-mismatch \(/ } },
    followersOnly: true,
    plugin: () => ({
      name: "uf-canary-L10-pixels",
      ir: (module) =>
        mapRoots(module, (root) => {
          // Not `invert(1)`, which is its own inverse: a child's root inside a parent's would
          // render its pixels as they were.
          setStyle(root, createStaticStyle("filter", "invert(0.8)", root.span));
        }),
    }),
  },
  {
    id: "L10-stylesheet-rule-dropped",
    layer: "L10",
    description:
      "Drops the first style rule outside `@keyframes` from every scoped sheet on every target but the reference, on the cases that emit one: the rule's declarations no longer apply, so the geometry differs from the reference's.",
    evidence: { browser: { geometry: /geometry-mismatch \(/ } },
    followersOnly: true,
    sheets: true,
    // Every styled case's first such rule sets a property the geometry captures (`layers` has
    // none at the top level, and `keyframes` starts with its `@keyframes`).
    appliesTo: (info) => info.styled,
    plugin: () => ({
      name: "uf-canary-L10-sheet",
      output: (files) =>
        files.map((file) =>
          file.path.endsWith(".css") ? { ...file, contents: dropFirstRule(file) } : file,
        ),
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
      "Gives every Qwik component a leaf component, rendered last, with a document listener, for the events every action dispatches, that throws a task later: nothing the component renders or does changes, and only Qwik's report of the error on the console (`QWIK ERROR`) shows it, on the cases whose specs act. Qwik's test mode (`qTest`) would silence the report.",
    // Qwik 2.0.0-beta.47's development build wraps the host of a handler that throws in an
    // `<errored-host>`, and loops forever where that host re-renders or holds another errored
    // host, or where its first wrap lands with a re-render the same event schedules (a select's
    // `input` and its model's `change` come in one task). The leaf has no props, no state and no
    // component children, and it throws a task after the event. The wrap is the leaf's, which L7
    // can see; the verdict asks L13 alone for its evidence.
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
      output: (files, { target, component }) =>
        target !== "qwik"
          ? undefined
          : files.map((file) => ({
              ...file,
              contents: withThrowingLeaf(
                file,
                `UfCanaryLeaf${component.name}`,
                `useOnDocument(${JSON.stringify(ACTION_EVENTS)}, $(async () => { await new Promise((resolve) => setTimeout(resolve)); throw new Error("${MARKER} L13 in ${target}"); }));`,
              ),
            })),
    }),
  },
];

/**
 * A Qwik file whose component renders `leaf` after what it returns, in a fragment
 * (`<><section>…</section><Leaf /></>`), and a component declared after it that runs `statement`
 * and renders nothing. The component's body is the first code after its opening brace that
 * parses as whole statements up to a brace the `component$` call's parenthesis closes; its last
 * statement is what it returns.
 */
function withThrowingLeaf(file: OutputFile, leaf: string, statement: string): string {
  const contents = withQwikImports(file, ["$", "useOnDocument"]);
  const body = componentBodyStart(contents);
  const fail = (): never => {
    throw new Error(`${MARKER} ${file.path} (qwik) has no component$ body that returns.`);
  };
  if (body === undefined) return fail();
  for (
    let close = contents.indexOf("}", body);
    close !== -1;
    close = contents.indexOf("}", close + 1)
  ) {
    if (!/^\s*\)/.test(contents.slice(close + 1))) continue;
    let statements: ParsedStatements["statements"];
    try {
      ({ statements } = parseStatementsSource(contents.slice(body, close)));
    } catch {
      continue;
    }
    const last = statements.at(-1);
    if (last?.type !== "ReturnStatement" || !last.argument) return fail();
    const start = body + last.argument.start;
    const end = body + last.argument.end;
    const returned = contents.slice(start, end);
    const child = /^JSX(?:Element|Fragment)$/.test(last.argument.type) ? returned : `{${returned}}`;
    return `${contents.slice(0, start)}<>${child}<${leaf} /></>${contents.slice(end).trimEnd()}

const ${leaf} = component$(() => {
  ${statement}
  return null;
});
`;
  }
  return fail();
}

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
 * compiles to; a canary that spares the reference needs it, and `references`, the cases that
 * name their own reference (ADR-0057), by id: it spares the modules of those whose reference
 * `target` is, as it spares the run's reference everywhere.
 */
export function canaryPlugins(
  id: string | null,
  target?: string,
  references: Readonly<Record<string, string>> = {},
): CompilerPlugin[] {
  if (!id) return [];
  const canary = findCanary(id);
  if (!canary.plugin) return [];
  if (target !== undefined && !corrupts(canary, target)) return [];
  const plugin = canary.sheets ? canary.plugin() : keepingSheets(canary.plugin());
  if (!canary.followersOnly) return [plugin];
  if (target === undefined) {
    throw new Error(
      `The ${id} canary spares the reference target, so it needs the project's target.`,
    );
  }
  if (target === REFERENCE) return [];
  const spared = Object.keys(references).filter((caseId) => references[caseId] === target);
  return [sparing(plugin, spared)];
}

/**
 * A plugin whose output hook sees a component's own files only. A styled component's files end
 * with its scoped sheet, `<source>.css` (ADR-0063), which has no template or script to corrupt:
 * a hook that threw on it would become a UF8001, and the compiler would emit the module
 * uncorrupted. The sheet follows the hook's files as `compile()` emitted it.
 */
function keepingSheets(plugin: CompilerPlugin): CompilerPlugin {
  if (!plugin.output) return plugin;
  return {
    ...plugin,
    output: (files, context) => {
      const sheets = files.filter(({ path }) => path.endsWith(".css"));
      if (!sheets.length) return plugin.output!(files, context);
      const own = files.filter(({ path }) => !path.endsWith(".css"));
      const result = plugin.output!(own, context);
      return result ? [...result, ...sheets] : undefined;
    },
  };
}

/** A plugin that leaves the modules of some cases, by id, as they are. */
function sparing(plugin: CompilerPlugin, cases: readonly string[]): CompilerPlugin {
  if (!cases.length) return plugin;
  const spared = (module: UfModule) =>
    cases.some((id) =>
      new RegExp(`(?:^|/)${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[^/]+$`).test(module.file),
    );
  return {
    name: plugin.name,
    ...(plugin.ir
      ? { ir: (module: UfModule) => (spared(module) ? undefined : plugin.ir!(module)) }
      : {}),
    ...(plugin.output
      ? {
          output: (files: readonly OutputFile[], context: OutputHookContext) =>
            spared(context.module) ? undefined : plugin.output!(files, context),
        }
      : {}),
  };
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
  // Every source's IR (ADR-0057): the canaries corrupt every module a case compiles.
  const irs = info.sources.map((source) => join(info.dir, "__output__", source.ir));
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
    listens: irs.some(
      (ir) => existsSync(ir) && listens(JSON.parse(readFileSync(ir, "utf8")) as UfModule),
    ),
    standIn: (target) => Object.hasOwn(standInCases([info], target, QUARANTINE), info.id),
    styled: irs.some(
      (ir) =>
        existsSync(ir) &&
        (JSON.parse(readFileSync(ir, "utf8")) as UfModule).components.some(
          (component) => component.styles?.length,
        ),
    ),
    reference: info.config.reference ?? REFERENCE,
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
      // Composition (ADR-0055): the elements of fills, fallbacks and a `Dynamic` node's children.
      case "Component":
      case "SlotOutlet":
      case "Dynamic":
        return elementsOf(childrenOf(node));
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

/**
 * A scoped sheet without its first style rule outside `@keyframes`, in document order (inside
 * `@media` or `@layer` too): from its selector to its block's closing brace. The sheets are
 * postcss's printing of the author's text (ADR-0063), so braces and semicolons outside comments
 * and strings delimit the rules. Throws for a sheet that has no such rule, which the canary
 * would leave as it was.
 */
export function dropFirstRule(file: OutputFile): string {
  const text = file.contents;
  /** The index of the last character of a comment or a string that starts at `at`, or `at`. */
  const skip = (at: number): number => {
    if (text.startsWith("/*", at)) {
      const close = text.indexOf("*/", at + 2);
      return close === -1 ? text.length : close + 1;
    }
    const quote = text[at];
    if (quote !== '"' && quote !== "'") return at;
    let end = at + 1;
    for (; end < text.length && text[end] !== quote; end++) if (text[end] === "\\") end++;
    return end;
  };
  /** The open blocks: whether each is a `@keyframes` block. */
  const blocks: boolean[] = [];
  /** Where the current statement's prelude starts, past whitespace and comments. */
  let start: number | undefined;
  for (let at = 0; at < text.length; at++) {
    const skipped = skip(at);
    if (skipped !== at) {
      if (start === undefined && !text.startsWith("/*", at)) start = at;
      at = skipped;
      continue;
    }
    const char = text[at]!;
    if (char === "{") {
      const prelude = text.slice(start ?? at, at);
      if (!prelude.startsWith("@") && blocks.at(-1) !== true) {
        let depth = 1;
        let end = at + 1;
        for (; end < text.length && depth > 0; end++) {
          end = skip(end);
          if (text[end] === "{") depth++;
          else if (text[end] === "}") depth--;
        }
        // From the start of its line, and up to the next line that holds anything.
        const line = text.lastIndexOf("\n", start! - 1) + 1;
        const from = /^[ \t]*$/.test(text.slice(line, start)) ? line : start;
        return `${text.slice(0, from)}${text.slice(end).replace(/^\s*\n/, "")}`;
      }
      blocks.push(/^@(?:-[a-z]+-)?keyframes\b/i.test(prelude));
      start = undefined;
    } else if (char === "}" || char === ";") {
      if (char === "}") blocks.pop();
      start = undefined;
    } else if (start === undefined && !/\s/.test(char)) {
      start = at;
    }
  }
  throw new Error(`${MARKER} ${file.path} has no style rule outside @keyframes to drop.`);
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
        // A component whose roots are components renders its text in them, and their own
        // compiles mark it (ADR-0053).
        if (!markText(render) && !rendersComponents(render)) {
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
      : render.children.flatMap((node): ElementNode[] =>
          node.kind === "Element"
            ? [node]
            : // A root component's fills render in it (ADR-0054).
              node.kind === "Component"
              ? node.fills.flatMap((fill) =>
                  fill.children.filter((child): child is ElementNode => child.kind === "Element"),
                )
              : [],
        );
  for (const root of always) {
    const holder = textHolder(root, "html");
    if (holder) {
      appendMarker(holder);
      return true;
    }
  }
  // A root `<component is>` over tags renders its children in whichever tag it chooses
  // (ADR-0054), each one that holds text.
  if (render.kind === "Fragment") {
    for (const node of render.children) {
      if (
        node.kind === "Dynamic" &&
        node.candidates.every(
          (candidate) =>
            candidate.kind === "Tag" &&
            textHolder(createElement(candidate.tag, [], [], node.span), "html"),
        )
      ) {
        appendMarker(node);
        return true;
      }
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
 * Whether a component's roots are all components, or `<component is>` over components, whose own
 * compiles render its text.
 */
function rendersComponents(render: ElementNode | FragmentNode): boolean {
  return (
    render.kind === "Fragment" &&
    render.children.length > 0 &&
    render.children.every(
      (node) =>
        node.kind === "Component" ||
        (node.kind === "Dynamic" &&
          node.candidates.every((candidate) => candidate.kind === "Component")),
    )
  );
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
function appendMarker(element: ElementNode | DynamicNode): void {
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
        return node.body.kind === "Element" ? [node.body] : [];
      case "Text":
      case "Interpolation":
      case "Component":
      case "SlotOutlet":
      case "Dynamic":
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
 * overlaps it (the IR's styles never do), or gives the element a `style` of its own. A style
 * bound to a value, or a spread's `style` key, holds no declarations (ADR-0065), and a plugin
 * may not write code of its own (UF8001), so such a root is left as it is: the root of the
 * component that renders it takes the declaration.
 */
function setStyle(element: ElementNode, declaration: StaticStyle): void {
  if (
    element.attributes.some(
      (attribute) =>
        (attribute.kind === "Style" && attribute.value) ||
        (attribute.kind === "Spread" && attribute.keys.some((key) => key.name === "style")),
    )
  ) {
    return;
  }
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
 * An output whose props, events and exported types a consumer sees as `any`: the type each
 * target's checker reads the props and events from, the component's props parameter (React,
 * Solid), its `$props()` (Svelte), its `Props` (Astro), or the type arguments of `component$`
 * (Qwik), `defineProps`, `defineModel`, `defineEmits` and `defineSlots` (Vue), and `input`,
 * `output` and `model` (Angular); and every exported `interface` and type alias, in any output
 * file, a copied `.ts` module included, so a consumer's misuse of an exported type goes unmet
 * too (ADR-0068). An output with none of them is left as it is.
 */
function widenPublicTypes(file: OutputFile, target: string): string {
  return anyExportedTypes(widenProps(file, target));
}

/** {@link widenPublicTypes}'s props and events. */
function widenProps(file: OutputFile, target: string): string {
  const { contents } = file;
  switch (target) {
    case "react":
    case "solid": {
      const component = /\bfunction\s+[A-Z][\w$]*\s*\(/.exec(contents);
      if (!component) return contents;
      const open = component.index + component[0].length - 1;
      const close = matchingBracket(contents, open, "(", ")");
      if (close === undefined) return contents;
      // The parameter: a destructuring pattern or a name, then its annotation.
      const pattern =
        contents[open + 1] === "{" ? matchingBracket(contents, open + 1, "{", "}") : open;
      const colon = pattern === undefined ? -1 : contents.indexOf(":", pattern + 1);
      if (colon === -1 || colon > close) return contents;
      return `${contents.slice(0, colon)}: any${contents.slice(close)}`;
    }
    case "qwik":
      return anyTypeArguments(contents, /\bcomponent\$</g);
    case "vue":
      // `defineProps<any>()` declares no props to vue-tsc: each key takes anything instead.
      return anyTypeArguments(
        anyTypeArguments(
          anyTypeArguments(
            anyTypeArguments(contents, /\bdefineProps</g, "Record<string, any>"),
            /\bdefineModel</g,
          ),
          /\bdefineEmits</g,
          "Record<string, any[]>",
        ),
        /\bdefineSlots</g,
        "Record<string, (props: any) => any>",
      );
    case "angular":
      return anyTypeArguments(contents, /\b(?:input|output|model)(?:\.required)?</g);
    case "svelte":
      return contents.replace(/(\})\s*:[^=;]+=\s*\$props\(\)/, "$1: any = $props()");
    case "astro":
      return /\b(?:type|interface)\s+Props\b/.test(contents)
        ? injectScript(
            {
              ...file,
              contents: contents.replace(/\b(type|interface)\s+Props\b/, "$1 UfCanaryProps"),
            },
            target,
            "type Props = any;",
            "module",
          )
        : contents;
    default:
      throw new Error(`${MARKER} L4: no public types to widen for the target ${target}.`);
  }
}

/**
 * `contents` with each exported `interface` and type alias declared `any`, its type parameters
 * kept, so every reference to it still checks: `export type ButtonProps = any;`,
 * `export type ListProps<T> = any;`. A type re-export, `export type { Tone } from "./types"`,
 * declares each name it exports `any` in its place: the `.ts` module it names is copied into the
 * output tree beside the outputs, where no output hook reaches (ADR-0070).
 */
export function anyExportedTypes(contents: string): string {
  const reExported = new Set<string>();
  contents = contents.replace(
    /\bexport\s+type\s*\{([^}]*)\}\s*from\s*(["'])[^"']*\2;?/g,
    (_, names: string) =>
      names
        .split(",")
        .map((name) =>
          name
            .trim()
            .split(/\s+as\s+/)
            .at(-1)!,
        )
        .filter(Boolean)
        .map((name) => {
          reExported.add(name);
          return `export type ${name} = any;`;
        })
        .join("\n"),
  );
  // A type import of a name the module re-exported now declares it twice (TS2440): the
  // declaration replaces the import, and an import left with no name goes.
  contents = contents.replace(
    /^(\s*)import\s+type\s*\{([^}]*)\}\s*from\s*(["'][^"']*["']);?[ \t]*\n?/gm,
    (whole, indent: string, names: string, from: string) => {
      const kept = names
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name && !reExported.has(name.split(/\s+as\s+/).at(-1)!));
      if (kept.length === names.split(",").filter((name) => name.trim()).length) return whole;
      return kept.length ? `${indent}import type { ${kept.join(", ")} } from ${from};\n` : "";
    },
  );
  let result = "";
  let from = 0;
  for (const match of contents.matchAll(/\bexport\s+(interface|type)\s+([A-Za-z_$][\w$]*)/g)) {
    if (match.index < from) continue;
    let index = match.index + match[0].length;
    while (/\s/.test(contents[index] ?? "")) index += 1;
    let parameters = "";
    if (contents[index] === "<") {
      const close = matchingBracket(contents, index, "<", ">");
      if (close === undefined) continue;
      parameters = contents.slice(index, close + 1);
      index = close + 1;
    }
    const end =
      match[1] === "interface"
        ? interfaceEnd(contents, index)
        : statementEnd(contents, contents.indexOf("=", index));
    if (end === undefined) continue;
    result += `${contents.slice(from, match.index)}export type ${match[2]}${parameters} = any;`;
    from = end + 1;
  }
  return result + contents.slice(from);
}

/** The index of the `}` that ends an interface whose header ends at `from`. */
function interfaceEnd(contents: string, from: number): number | undefined {
  const open = contents.indexOf("{", from);
  return open === -1 ? undefined : matchingBracket(contents, open, "{", "}");
}

/** The index of the `;` that ends a type alias whose `=` is at `from`, outside any bracket. */
function statementEnd(contents: string, from: number): number | undefined {
  if (from === -1) return undefined;
  let depth = 0;
  for (let index = from + 1; index < contents.length; index += 1) {
    const char = contents[index]!;
    if (char === '"' || char === "'" || char === "`") {
      const end = endOfString(contents, index);
      if (end === undefined) return undefined;
      index = end;
    } else if ("{([<".includes(char)) {
      depth += 1;
    } else if ("})]".includes(char) || (char === ">" && contents[index - 1] !== "=")) {
      depth -= 1;
    } else if (char === ";" && depth === 0) {
      return index;
    }
  }
  return undefined;
}

/** `contents` with the type arguments after each match of `opening` (which ends at `<`) `any`. */
function anyTypeArguments(contents: string, opening: RegExp, type = "any"): string {
  let result = "";
  let from = 0;
  for (const match of contents.matchAll(opening)) {
    const open = match.index + match[0].length - 1;
    if (open < from) continue;
    const close = matchingBracket(contents, open, "<", ">");
    if (close === undefined) continue;
    result += `${contents.slice(from, open + 1)}${type}`;
    from = close;
  }
  return result + contents.slice(from);
}

/**
 * Adds an attribute, written in the file's own syntax, to the root element of an output file:
 * the first element of its template. In JSX that is the first DOM element: an upper-case tag is a
 * component (React's `<DepthKey value>` provider, a child), whose props no DOM rule reads. A
 * template with no DOM element takes it on its first element.
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
  let match = element.exec(contents);
  if (match && path.endsWith(".tsx")) {
    const first = match;
    while (match && match.index < range.end && /^<[A-Z]/.test(match[0])) {
      match = element.exec(contents);
    }
    if (!match || match.index >= range.end) match = first;
  }
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
    // The component's class, after its decorator: a directive the file declares before it (a
    // listener's option, the scope directive of ADR-0063) has a class of its own.
    const decorator = Math.max(contents.indexOf("@Component("), 0);
    const before = contents.slice(0, decorator);
    const component = contents.slice(decorator);
    // The constructor runs once per render: an existing one's body gets the statement first,
    // before the effects and hooks it registers (M2's outputs have one).
    const existing = insertAfter(component, /\bconstructor\s*\([^)]*\)\s*\{/, `\n    ${statement}`);
    if (existing !== undefined) return `${before}${existing}`;
    // The class's members follow: a constructor before them still runs once per render.
    const start = classBodyStart(component);
    return start === undefined
      ? fail("component class")
      : `${before}${component.slice(0, start)}\n  constructor() {\n    ${statement}\n  }\n${component.slice(start)}`;
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

/**
 * Where the body of the first exported class starts, after its `{` (Angular). The type
 * parameters of a generic component's class are read to their matching bracket: a constraint may
 * hold braces of its own (`class Table<T extends { id: string }>`, ADR-0068).
 */
function classBodyStart(contents: string): number | undefined {
  const declaration = /export\s+(?:default\s+)?class\s+[\w$]+\s*/.exec(contents);
  if (!declaration) return undefined;
  let index = declaration.index + declaration[0].length;
  if (contents[index] === "<") {
    const parameters = matchingBracket(contents, index, "<", ">");
    if (parameters === undefined) return undefined;
    index = parameters + 1;
  }
  return endAt(contents, index, /^[^{]*\{/);
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
