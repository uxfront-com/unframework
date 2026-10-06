// L4 against the attribute vocabulary (design §1.5, §1.7): vue-tsc with strict templates checks
// every attribute of a native element against Vue's element types, where TSX leaves a hyphenated
// name the types do not declare unchecked. So a source can type-check with a hyphenated attribute
// that its Vue output fails on (`accept-charset`: Vue's types declare `acceptcharset`). Every
// hyphenated attribute the analyser accepts, on its element, must be a name vue-tsc knows. A name
// Vue's types lack goes in the toolchain's `dataAttributes` (tests/toolchains/vue/tsconfig.json),
// or the analyser rejects it. Values are out of scope: a declared name's value is checked in the
// source already, against the same Vue types the authoring JSX types are vendored from.
import {
  ARIA_ATTRIBUTES,
  SVG_PRESENTATION_ATTRIBUTES,
  createComponent,
  createElement,
  createExport,
  createModule,
  ELEMENT_ATTRIBUTES,
  GLOBAL_ATTRIBUTES,
  SVG_ELEMENT_ATTRIBUTES,
  SVG_ELEMENTS,
  SVG_GLOBAL_ATTRIBUTES,
} from "@unframework/ir";
import type { ElementNode } from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { packageDir, removeScratch, toolchainDir, writeScratch } from "./helpers.ts";

afterAll(removeScratch);

/** One attribute on one element, in the markup the element needs around it. */
interface Pair {
  tag: string;
  name: string;
  /** The source of the tree, with `VALUE` where the attribute's value goes. */
  source: string;
}

const hyphenated = (names: Iterable<string>) => [...names].filter((name) => name.includes("-"));

/** Global attributes on a `<div>`, each element's own on it, SVG's inside an `<svg>`. */
function pairs(): Pair[] {
  const found: Pair[] = [];
  for (const name of hyphenated([...GLOBAL_ATTRIBUTES, ...ARIA_ATTRIBUTES])) {
    found.push({ tag: "div", name, source: `<div ${name}="VALUE">a</div>` });
  }
  for (const [tag, names] of ELEMENT_ATTRIBUTES) {
    for (const name of hyphenated(names)) {
      found.push({ tag, name, source: `<div><${tag} ${name}="VALUE"></${tag}></div>` });
    }
  }
  for (const tag of SVG_ELEMENTS) {
    const names = new Set([...SVG_GLOBAL_ATTRIBUTES, ...(SVG_ELEMENT_ATTRIBUTES.get(tag) ?? [])]);
    for (const name of hyphenated(names)) {
      found.push({ tag, name, source: `<svg><${tag} ${name}="VALUE" /></svg>` });
    }
  }
  return found;
}

/** Values to try, first accepted wins: the analyser validates ARIA's and numbers' values. */
const VALUES = ["1", "x", "true", "polite", "horizontal", "text", "none"];

/** The tree of every pair the analyser accepts with one of the values, by pair. */
function accepted(): Map<Pair, ElementNode> {
  const all = pairs();
  const candidates = all.flatMap((pair) => VALUES.map((value) => ({ pair, value })));
  const source = candidates
    .map(
      ({ pair, value }, index) =>
        `export function Sweep${index}() {\n  return ${pair.source.replace("VALUE", value)};\n}\n`,
    )
    .join("");
  // A component the analyser rejects is left out of the module; its siblings are not.
  const { module } = analyze(parseModule("Sweep.uf.tsx", source));
  const trees = new Map<Pair, ElementNode>();
  for (const component of module?.components ?? []) {
    const { pair } = candidates[Number(component.name.slice("Sweep".length))]!;
    if (!trees.has(pair) && component.render.kind === "Element") {
      trees.set(pair, component.render);
    }
  }
  return trees;
}

describe("vue attribute vocabulary (L4)", { timeout: 60_000 }, () => {
  it("passes vue-tsc for every hyphenated attribute the analyser accepts", async () => {
    const trees = accepted();
    // Most of them: ARIA's, SVG's presentation attributes on each SVG element, and a few more.
    expect(trees.size).toBeGreaterThan(1000);
    const at = { start: 0, end: 0 };
    const render = createElement("div", [], [...trees.values()], at);
    const module = createModule(
      "Vocabulary.uf.tsx",
      [createComponent("Vocabulary", render, at)],
      [createExport("default", "Vocabulary", at)],
    );
    const [file] = target.emit(module.components[0]!, {
      module,
      options: undefined,
      report: () => {},
    });
    const { "Vocabulary.vue": path } = writeScratch({ "Vocabulary.vue": file!.contents });
    const messages = (await toolchain.typecheck([path!], { toolchainDir, root: packageDir })).get(
      path!,
    );
    const lines = file!.contents.split("\n");
    // TS2353: a property the element's type does not declare, at the attribute's line. TS2322
    // (the sweep's value outside a declared name's type) is the source's own type error.
    const unknown = (messages ?? [])
      .filter(({ code }) => code === "TS2353")
      .map(({ line }) => lines[line! - 1]!.trim());
    expect((messages ?? []).filter(({ code }) => code !== "TS2353" && code !== "TS2322")).toEqual(
      [],
    );
    // Vue types an SVG `<title>` as HTML's, so SVG's presentation attributes are unknown there.
    // They do nothing on a `<title>`, and the analyser is to reject them (UF3006): this list
    // empties when it does.
    const titles = [...trees.keys()]
      .filter(({ tag, name }) => tag === "title" && SVG_PRESENTATION_ATTRIBUTES.has(name))
      .map(({ name }) => `<title ${name}="1" />`);
    expect(unknown).toEqual(titles);
  });
});
