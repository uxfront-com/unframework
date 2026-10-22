// The child-root rule's shared parts (ADR-0063): the root nodes a JSX target spreads a styled
// parent's scope attributes on, as Vue's attribute fallthrough reaches them, the helper names a
// module's components take, and the pattern rest React picks them out of.
import { analyze } from "@unframework/analyzer";
import type { UfComponent } from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import { describe, expect, it } from "vitest";

import { js, moduleHelperName, NameScope, printProgram, scopeRoots } from "../src/index.ts";

/** The last component of a source, lowered by the analyser. */
function lowered(source: string): UfComponent {
  const { module, diagnostics } = analyze(parseModule("Fixture.uf.tsx", source));
  expect(diagnostics).toEqual([]);
  return module!.components.at(-1)!;
}

/** The source text of each root node `scopeRoots` names. */
function roots(source: string): string[] {
  return scopeRoots(lowered(source)).map(({ start, end }) => source.slice(start, end));
}

describe("scopeRoots", () => {
  it("names the root element, component or <component is>", () => {
    expect(roots(`export default function A() { return <p class="a">a</p>; }`)).toEqual([
      '<p class="a">a</p>',
    ]);
    expect(
      roots(`function B() { return <i />; }
export default function A() { return <><B /></>; }`),
    ).toEqual(["<B />"]);
    expect(
      roots(`export default function A({ big }: { big: boolean }) {
  return <component is={big ? "h2" : "h3"}>t</component>;
}`),
    ).toEqual(['<component is={big ? "h2" : "h3"}>t</component>']);
  });

  it("names each branch of a root conditional that renders one node alone", () => {
    expect(
      roots(`export default function A({ a, b }: { a: boolean; b: boolean }) {
  return <>{a ? <p>a</p> : b ? <i>b</i> : <><b>c</b><b>d</b></>}</>;
}`),
    ).toEqual(["<p>a</p>", "<i>b</i>"]);
  });

  it("names none where Vue renders a fragment, or with inheritAttrs: false", () => {
    // Several nodes, a list, text, and a branch that holds a conditional (`<template v-if>`).
    expect(roots(`export default function A() { return <><p /><p /></>; }`)).toEqual([]);
    expect(
      roots(`export default function A({ xs }: { xs: string[] }) {
  return <>{xs.map((x) => <p key={x}>{x}</p>)}</>;
}`),
    ).toEqual([]);
    expect(roots(`export default function A() { return <>text</>; }`)).toEqual([]);
    expect(
      roots(`export default function A({ a, b }: { a: boolean; b: boolean }) {
  return <>{a ? b ? <p>b</p> : <p>c</p> : <p>d</p>}</>;
}`),
    ).toEqual(["<p>d</p>"]);
    expect(
      roots(`import { defineOptions } from "unframework";
export default function A() {
  defineOptions({ inheritAttrs: false });
  return <p />;
}`),
    ).toEqual([]);
  });
});

describe("moduleHelperName", () => {
  it("gives each component a base of its own, and leaves it the others' and what they declare", () => {
    expect(moduleHelperName("cx", [[]], 0)).toEqual({ base: "cx", others: [] });
    expect(moduleHelperName("cx", [[], [], []], 0)).toEqual({
      base: "cx",
      others: ["cx_1", "cx_2"],
    });
    expect(moduleHelperName("cx", [[], [], []], 2)).toEqual({
      base: "cx_2",
      others: ["cx", "cx_1"],
    });
    // A name any component declares, before or after this one, is left to it: an output hoists
    // a `const` to the joined module's scope.
    expect(moduleHelperName("cx", [["cx_1_1", "cxs"], []], 0)).toEqual({
      base: "cx",
      others: ["cx_1_1", "cx_1"],
    });
  });

  // What another claim in a component takes first can't make two components declare one name.
  it("keeps every component's fallbacks apart", () => {
    const reserved = [["cx"], [], []];
    const claimed = reserved.map((own, index) => {
      const { base, others } = moduleHelperName("cx", reserved, index);
      const scope = new NameScope([...own, ...others]);
      scope.rebase("cx", base);
      scope.claim("cx_1");
      scope.claim("cx_2_1");
      return scope.claim("cx");
    });
    expect(claimed).toEqual(["cx_3", "cx_1_1", "cx_2"]);
    expect(new Set(claimed).size).toBe(3);
  });
});

describe("bindingRestElement", () => {
  it("prints the rest of an object pattern", () => {
    const pattern = js.objectPattern([js.bindingProperty("label"), js.bindingRestElement("rest")]);
    const fn = js.functionDeclaration("A", [pattern], []);
    expect(printProgram(js.program([fn]))).toBe("function A({ label, ...rest }) {}\n");
  });
});
