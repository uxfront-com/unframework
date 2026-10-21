// The child-root rule's shared parts (ADR-0063): the root nodes a JSX target spreads a styled
// parent's scope attributes on, as Vue's attribute fallthrough reaches them, the helper names a
// module's components take, and the pattern rest React picks them out of.
import { analyze } from "@unframework/analyzer";
import type { UfComponent } from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import { describe, expect, it } from "vitest";

import { js, moduleHelperNames, printProgram, scopeRoots } from "../src/index.ts";

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

describe("moduleHelperNames", () => {
  it("leaves every component the names the module declares, and the earlier ones' claims", () => {
    expect(moduleHelperNames("cx", [[], []], 0)).toEqual([]);
    expect(moduleHelperNames("cx", [[], []], 1)).toEqual(["cx"]);
    // A name any component declares, before or after this one, stays its own: an output hoists
    // a `const` to the joined module's scope.
    expect(moduleHelperNames("cx", [["cx"], []], 1)).toEqual(["cx", "cx_1"]);
    expect(moduleHelperNames("cx", [[], ["cx"]], 0)).toEqual(["cx"]);
    expect(moduleHelperNames("cx", [["cx_1", "cxs"], [], []], 2)).toEqual(["cx_1", "cx", "cx_2"]);
  });
});

describe("bindingRestElement", () => {
  it("prints the rest of an object pattern", () => {
    const pattern = js.objectPattern([js.bindingProperty("label"), js.bindingRestElement("rest")]);
    const fn = js.functionDeclaration("A", [pattern], []);
    expect(printProgram(js.program([fn]))).toBe("function A({ label, ...rest }) {}\n");
  });
});
