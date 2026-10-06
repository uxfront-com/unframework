// L4 across the contract (design §1.5, §5.3): what the analyzer accepts must type-check against
// Svelte's own element types (`svelte/elements`, through svelte-check), not only against the
// authoring types (vendored from Vue). svelte-check checks a component's attributes once it has
// a TypeScript script, written ones by name and bound ones by value too: Svelte declares some
// attributes on a few elements only (`autocorrect`, which the target then writes as an object
// spread) and types many enumerated attributes (`dir`, `autocomplete`, `preload`) as literal
// unions where the authoring types say `string`. Two sweeps: every attribute the analyzer
// accepts written statically, in a component with a script; and every attribute bound to a
// `string`, a `number` and a `boolean` prop whose source tsgo (the author's editor) and the
// analyzer accept. Each emits and type-checks every case, which must all pass.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { typecheckWithTsgo } from "@unframework/codegen/toolchain-node";
import {
  ARIA_ATTRIBUTES,
  createComponent,
  createModule,
  createProp,
  createPropsParameter,
  createTypeText,
  ELEMENT_ATTRIBUTES,
  GLOBAL_ATTRIBUTES,
  HTML_ELEMENTS,
  isVoidElement,
  REQUIRED_PARENTS,
  SVG_ELEMENT_ATTRIBUTES,
  SVG_ELEMENTS,
  SVG_GLOBAL_ATTRIBUTES,
  SVG_PRESENTATION_ATTRIBUTES,
} from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

import { analyze } from "../../analyzer/src/index.ts";
import { attributeSweep } from "../../codegen/test/render-parity-node.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { removeScratch, repoRoot, scratchDir, toolchainDir } from "./helpers.ts";

afterAll(removeScratch);

/** A prop type and the attribute it is bound to. */
interface Candidate {
  key: string;
  tag: string;
  name: string;
  kind: string;
  svg: boolean;
}

function candidates(): Candidate[] {
  const found = new Map<string, Candidate>();
  const add = (tag: string, name: string, svg = false) => {
    for (const kind of ["string", "number", "boolean"]) {
      const key = `<${tag} ${name}> ${kind}`;
      found.set(key, { key, tag, name, kind, svg });
    }
  };
  for (const name of [...GLOBAL_ATTRIBUTES, ...ARIA_ATTRIBUTES, "data-x"]) add("div", name);
  for (const tag of HTML_ELEMENTS) {
    for (const name of ELEMENT_ATTRIBUTES.get(tag) ?? []) add(tag, name);
  }
  for (const name of [...SVG_GLOBAL_ATTRIBUTES, ...SVG_PRESENTATION_ATTRIBUTES])
    add("g", name, true);
  for (const tag of SVG_ELEMENTS) {
    for (const name of SVG_ELEMENT_ATTRIBUTES.get(tag) ?? []) add(tag, name, true);
  }
  return [...found.values()];
}

/** JSX binding the candidate's attribute to `v`, inside the parents its element needs. */
function markup({ tag, name, svg }: Candidate): string {
  let source =
    isVoidElement(tag) || svg ? `<${tag} ${name}={v} />` : `<${tag} ${name}={v}></${tag}>`;
  if (svg) return tag === "svg" ? source : `<svg>${source}</svg>`;
  for (let child = tag, parents = REQUIRED_PARENTS.get(child); parents;) {
    child = [...parents][0]!;
    source = `<${child}>${source}</${child}>`;
    parents = REQUIRED_PARENTS.get(child);
  }
  return source;
}

/** Lines per component in the sweep's source, so a type error's line names its component. */
const LINES = 3;

/** Type-checks emitted files with svelte-check and returns the names of the failing ones. */
async function failing(files: ReadonlyMap<string, string>): Promise<string[]> {
  const results = await toolchain.typecheck([...files.keys()], { toolchainDir, root: repoRoot });
  return [...results]
    .filter(([, messages]) => messages.length > 0)
    .map(([path]) => files.get(path) ?? path)
    .toSorted();
}

const at = { start: 0, end: 0 };

describe("svelte attribute types", () => {
  it("type-checks every static attribute the analyzer accepts", { timeout: 120_000 }, async () => {
    // A prop no expression reads: the component gets a TypeScript script, and so its markup is
    // type-checked, as every component with props is.
    const type = createTypeText("{ label?: string }", at);
    const props = [createProp("label", true, createTypeText("string", at), at)];
    const parameter = createPropsParameter("destructured", type, at);
    const outputs = scratchDir();
    const checked = new Map<string, string>();
    attributeSweep().forEach(({ name, render }, index) => {
      const component = createComponent(`S${index}`, render, at, props, parameter);
      const module = createModule("Sweep.uf.tsx", [component], []);
      for (const file of target.emit(component, { module, options: undefined, report: () => {} })) {
        expect(file.contents).toContain('<script lang="ts">');
        const path = join(outputs, file.path);
        writeFileSync(path, file.contents);
        checked.set(path, name);
      }
    });
    // Several hundred attributes; far fewer means the vocabulary or the analyzer broke.
    expect(checked.size).toBeGreaterThan(300);
    expect(await failing(checked)).toEqual([]);
  });

  it(
    "type-checks every binding the authoring types and the analyzer accept",
    { timeout: 120_000 },
    async () => {
      const all = candidates();
      const source = all
        .map(
          (candidate, index) =>
            `export function S${index}({ v }: { v?: ${candidate.kind} }) {\n` +
            `  return <div>${markup(candidate)}</div>;\n}\n`,
        )
        .join("");

      // The author's editor: tsgo with the authoring settings and the `unframework` JSX types.
      const sources = scratchDir();
      writeFileSync(
        join(sources, "tsconfig.json"),
        JSON.stringify({
          extends: join(repoRoot, "tests/integration/tsconfig.cases.json"),
          compilerOptions: {
            paths: { "unframework/*": [join(repoRoot, "packages/unframework/src/*")] },
          },
        }),
      );
      writeFileSync(join(sources, "Sweep.uf.tsx"), source);
      const typed = await typecheckWithTsgo([join(sources, "Sweep.uf.tsx")], {
        toolchainDir: sources,
        root: sources,
      });
      const rejected = new Set(
        [...typed.values()].flat().map(({ line }) => Math.floor((line! - 1) / LINES)),
      );

      const { module } = analyze(parseModule("Sweep.uf.tsx", source));
      const outputs = scratchDir();
      const checked = new Map<string, string>();
      for (const component of module!.components) {
        const index = Number(component.name.slice(1));
        if (rejected.has(index)) continue;
        const context = { module: module!, options: undefined, report: () => {} };
        for (const file of target.emit(component, context)) {
          const path = join(outputs, file.path);
          writeFileSync(path, file.contents);
          checked.set(path, all[index]!.key);
        }
      }
      // Several hundred bindings; far fewer means the vocabulary, tsgo or the analyzer broke.
      expect(checked.size).toBeGreaterThan(600);

      expect(await failing(checked)).toEqual([]);
    },
  );
});
