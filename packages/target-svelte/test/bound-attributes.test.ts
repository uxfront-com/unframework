// L4 across the contract (design §1.5, §5.3): an attribute bound to a prop whose type the
// authoring types accept, and that the analyzer accepts, must type-check against Svelte's own
// element types (`svelte/elements`, through svelte-check) too. Svelte checks bound values only
// (`svelte2tsx` leaves static ones alone), and types many enumerated attributes as literal
// unions where the authoring types (vendored from Vue) say `string`, so a valid source can fail
// L4 on Svelte alone. The sweep binds every attribute the vocabulary knows to a `string`, a
// `number` and a `boolean` prop, keeps what tsgo (the author's editor) and the analyzer accept,
// emits it and type-checks it. `KNOWN_GAPS` lists what still fails: each is for the analyzer
// to reject on every target (§0), and the test fails when one passes, so the list only shrinks.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { typecheckWithTsgo } from "@unframework/codegen/toolchain-node";
import {
  ARIA_ATTRIBUTES,
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
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { removeScratch, repoRoot, scratchDir, toolchainDir } from "./helpers.ts";

afterAll(removeScratch);

/**
 * What still fails, by `<element attribute> kind`: enumerated attributes typed `string` by the
 * authoring types and as literal unions by Svelte (the analyzer is to require literal kinds,
 * within Svelte's set), attributes Svelte's types do not declare (not to be bound), and a number
 * where Svelte's types want a string.
 */
const KNOWN_GAPS: readonly string[] = [
  "<area shape> string",
  "<audio crossorigin> string",
  "<audio preload> string",
  "<button formenctype> string",
  "<button formmethod> string",
  "<div aria-braillelabel> boolean",
  "<div aria-braillelabel> number",
  "<div aria-braillelabel> string",
  "<div aria-brailleroledescription> boolean",
  "<div aria-brailleroledescription> number",
  "<div aria-brailleroledescription> string",
  "<div aria-description> boolean",
  "<div aria-description> number",
  "<div aria-description> string",
  "<div autocapitalize> string",
  "<div autocorrect> string",
  "<div dir> string",
  "<form autocomplete> string",
  "<form enctype> string",
  "<form method> string",
  "<g stroke-miterlimit> number",
  "<input autocomplete> string",
  "<select autocomplete> string",
  "<textPath method> string",
  "<textarea autocomplete> string",
  "<textarea wrap> string",
  "<th scope> string",
  "<track kind> string",
  "<video crossorigin> string",
  "<video preload> string",
];

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

describe("svelte bound attribute types", () => {
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
      // About a thousand bindings; far fewer means the vocabulary, tsgo or the analyzer broke.
      expect(checked.size).toBeGreaterThan(800);

      const results = await toolchain.typecheck([...checked.keys()], {
        toolchainDir,
        root: repoRoot,
      });
      const failing = [...results]
        .filter(([, messages]) => messages.length > 0)
        .map(([path]) => checked.get(path) ?? path);
      expect(failing.toSorted()).toEqual([...KNOWN_GAPS].toSorted());
    },
  );
});
