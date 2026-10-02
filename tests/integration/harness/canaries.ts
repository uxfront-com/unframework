// Canaries (plan §7.7): test-only corruptions of a compile (a compiler plugin, mostly) in a way
// one layer exists to catch. `pnpm test:canaries` runs each against the projects that verify
// its layer, with `UF_CANARY=<id>`, and fails unless the run fails with that layer failing on
// every case it corrupts, on every target, with the evidence of every sub-check the canary
// names (`canary-verdict.ts`). A layer that fails because its tool crashed proves nothing, and a
// sub-check that never fails on its own (ARIA behind the DOM, pixels behind geometry, the
// golden files behind the IR snapshot, determinism and formatting behind the golden files) is
// not proven by its sibling.
//
// One sub-check has no canary yet: L1's "every fix applies and recompiles clean". No M0 case
// has a diagnostic with a fix, and no compiler hook reaches the fixes a canary would have to
// break; `compile-checks.unit.test.ts` proves the check on the real compiler until a case with
// a fixable diagnostic (M1's attribute cases) and a way to corrupt its fix exist.
import type { OutputFile } from "@unframework/codegen";
import type { CompilerPlugin } from "@unframework/compiler";
import { createStaticAttribute } from "@unframework/ir";
import type { ElementNode, RenderNode, UfModule } from "@unframework/ir";
import type { LayerName, ProjectKind } from "@unframework/testing/node";

import { REFERENCE } from "./targets.ts";

/** What a sub-check's failure says: a pattern, or one built for the target of the cell. */
export type Evidence = RegExp | ((target: string) => RegExp);

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
}

const MARKER = "[uf canary]";

/** A golden output file of the cell's own target. */
const goldenFile = (target: string) => `__output__/${target}/\\S+`;

/** The golden guard's failure for a module of the cell's own target. */
const guardFailure = (target: string) =>
  new RegExp(`\\[uf guard\\] The ${target} output of \\S+ is not its golden output`);

/** How many compiles the L2-nondeterministic canary has numbered in this process. */
let compiles = 0;

/** Every canary: at least one per live layer, and one per sub-check a sibling could hide. */
export const CANARIES: readonly Canary[] = [
  {
    id: "L1-diagnostic-added",
    layer: "L1",
    description:
      'Prepends `import "react";` to every case\'s source in the compile project: an unexpected UF1201 on every case, and on the diagnostics case its own diagnostic a line further down.',
    evidence: {
      compile: { diagnostics: /__expected__\/diagnostics\.json differs[\s\S]*UF1201/ },
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
          root.attributes.push(createStaticAttribute("data-uf-canary", "L2", root.span));
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
      "Renames the first closing tag of every output (`</p>` → `</span>`): the one corruption all seven framework compilers reject (the framework-compile ADR).",
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
    id: "L6-wrong-text",
    layer: "L6",
    description: "Changes the first text node of every component: the server HTML differs.",
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
      "Changes the first text node of every component: the client DOM and its ARIA tree differ.",
    evidence: {
      browser: {
        DOM: /__expected__\/dom\.[a-z0-9-]+\.html differs/,
        "ARIA tree": /__expected__\/aria\.[a-z0-9-]+\.yaml differs/,
      },
    },
    plugin: wrongText,
  },
  {
    id: "L10-root-hidden",
    layer: "L10",
    description:
      "Adds `hidden` to every component's root on every target but the reference: the geometry differs from the reference's, live or committed.",
    evidence: { browser: { geometry: /geometry-mismatch \(/ } },
    followersOnly: true,
    plugin: () => ({
      name: "uf-canary-L10-geometry",
      ir: (module) =>
        mapRoots(module, (root) => {
          root.attributes.push(createStaticAttribute("hidden", true, root.span));
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
    // An output hook: a static `style` is not in the M0 source language, so the IR cannot
    // carry it to React.
    plugin: () => ({
      name: "uf-canary-L10-pixels",
      output: (files) =>
        files.map((file) => ({
          ...file,
          contents: addRootAttribute(file, {
            jsx: 'style={{ filter: "invert(1)" }}',
            markup: 'style="filter: invert(1)"',
          }),
        })),
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
          root.attributes.push(createStaticAttribute("role", "uf-canary", root.span));
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
  if (!canary.followersOnly) return [canary.plugin()];
  if (target === undefined) {
    throw new Error(
      `The ${id} canary spares the reference target, so it needs the project's target.`,
    );
  }
  return target === REFERENCE ? [] : [canary.plugin()];
}

/** A case's source as the compile project compiles it: corrupted by a source canary. */
export function canarySource(id: string | null, text: string): string {
  const canary = id ? findCanary(id) : undefined;
  return canary?.source ? canary.source(text) : text;
}

/** Whether the compile project formats its output: always, except under a format canary. */
export function canaryFormats(id: string | null): boolean {
  return !id || findCanary(id).format !== false;
}

/** Whether a run keeps the golden guard on: always, except under a canary that changes outputs. */
export function guardsGoldens(id: string | null): boolean {
  return !id || findCanary(id).guard === true;
}

function wrongText(): CompilerPlugin {
  return {
    name: "uf-canary-wrong-text",
    ir: (module) =>
      mapRoots(module, (root) => {
        const text = firstText(root);
        if (!text) throw new Error(`${MARKER} the component has no text to change.`);
        text.value = `${text.value} (canary)`;
      }),
  };
}

/** A copy of the module with `change` applied to each component's root element. */
function mapRoots(module: UfModule, change: (root: ElementNode) => void): UfModule {
  const copy = structuredClone(module);
  for (const component of copy.components) change(component.render);
  return copy;
}

function firstText(node: RenderNode): Extract<RenderNode, { kind: "Text" }> | undefined {
  if (node.kind === "Text") return node;
  for (const child of node.children) {
    const found = firstText(child);
    if (found) return found;
  }
  return undefined;
}

/** Renames the first closing tag so it no longer matches its opening tag. */
export function mismatchClosingTag(file: OutputFile): string {
  const match = /<\/([a-z][a-z0-9-]*)\s*>/.exec(file.contents);
  if (!match) throw new Error(`${MARKER} L3: ${file.path} has no closing tag to mismatch.`);
  const replacement = match[1] === "span" ? "div" : "span";
  return `${file.contents.slice(0, match.index)}</${replacement}>${file.contents.slice(match.index + match[0].length)}`;
}

/**
 * Adds an attribute to the root element of an output file: `jsx` in a JSX file, `markup` in a
 * template. The root is the first element of the template: after `return` in JSX, inside
 * `template:` in an Angular class, inside `<template>` in Vue, and after Svelte's options and
 * Astro's frontmatter.
 */
export function addRootAttribute(
  file: OutputFile,
  attribute: { jsx: string; markup: string },
): string {
  const { path, contents } = file;
  const start = templateStart(path, contents);
  if (start === undefined) {
    throw new Error(`${MARKER} ${path} has no template to find the root element in.`);
  }
  // An element's name is followed by a space, `/` or `>`: `<svelte:options` is not one.
  const element = /<(?!(?:script|style|template)\b)[a-z][a-z0-9-]*(?=[\s/>])/g;
  element.lastIndex = start;
  const match = element.exec(contents);
  if (!match) throw new Error(`${MARKER} ${path} has no root element to add an attribute to.`);
  const end = match.index + match[0].length;
  const text = path.endsWith(".tsx") ? attribute.jsx : attribute.markup;
  return `${contents.slice(0, end)} ${text}${contents.slice(end)}`;
}

/** Where an output file's template starts, in each target's own syntax. */
function templateStart(path: string, contents: string): number | undefined {
  if (path.endsWith(".tsx")) return endOf(/\breturn\b/.exec(contents));
  if (path.endsWith(".ts")) return endOf(/\btemplate:\s*`/.exec(contents));
  if (path.endsWith(".vue")) return endOf(/<template>/.exec(contents));
  if (path.endsWith(".astro") && contents.startsWith("---\n")) {
    return endOf(/\n---\n/.exec(contents));
  }
  return 0;
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
    if (/\bconstructor\s*\(/.test(contents)) fail("constructor-free class");
    return (
      insertAfter(
        contents,
        /export\s+(?:default\s+)?class\s+\w+[^{]*\{/,
        `\n  constructor() {\n    ${statement}\n  }\n`,
      ) ?? fail("component class")
    );
  }
  if (target === "qwik") {
    return (
      insertAfter(contents, /component\$\(\s*\([^)]*\)\s*=>\s*\{/, `\n  ${statement}`) ??
      fail("component$ body")
    );
  }
  return (
    insertAfter(contents, /function\s+[A-Z][\w$]*\s*\([^)]*\)[^{]*\{/, `\n  ${statement}`) ??
    fail("component function body")
  );
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
