// The source cases: every one is a component the analyser accepts, the suites put
// them into one component without changing what any renders, and the seeded fuzz is
// deterministic and as varied as the printers' hard parts.
import { walk } from "@unframework/ir";
import type { Attribute, Expression, RenderNode, UfComponent } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import {
  jsLiteral,
  lowerSources,
  parityModule,
  parityProps,
  paritySuites,
  sourceCases,
} from "./render-parity-node.ts";
import { instantiate } from "./render-parity-reference.ts";
import {
  FUZZ_SOURCE_SEEDS,
  fuzzSource,
  ROOT_SOURCE_SEEDS,
  TRICKY_SOURCES,
} from "./render-parity-sources.ts";
import { domNodesOf, el, expectedNodes } from "./render-parity.ts";
import type { DomElement, ParityCase, ParitySuite } from "./render-parity.ts";

const sourceSuites = () => paritySuites().filter(({ cases }) => cases[0]?.lowered);

describe("the source cases", () => {
  it("lower each alone, with no diagnostic, into a component of their own", () => {
    const suites = sourceSuites();
    expect(suites.length).toBeGreaterThan(20);
    for (const { cases } of suites) {
      for (const { name, lowered } of cases) {
        expect(lowered!.module.components, name).toHaveLength(1);
        expect(lowered!.module.components[0], name).toBe(lowered!.component);
      }
    }
  });

  // The respelling of props (`c12Label`, `props.c12Label`, shorthands expanded) must change
  // nothing a case renders, or the targets would be held to the wrong DOM.
  it("render the same put together in one component as alone", () => {
    for (const suite of sourceSuites()) {
      const [component] = parityModule(suite).components as [UfComponent];
      const nodes = domNodesOf(instantiate(component, parityProps(suite)));
      const rendered = suite.root === "self" ? nodes : (nodes[0] as DomElement).children;
      expect(rendered, suite.title).toEqual(suite.cases.flatMap(expectedNodes));
    }
  });

  it("read their props destructured, or through one object, as the suite says", () => {
    const suites = sourceSuites();
    const forms = (form: ParitySuite["form"]) =>
      suites
        .filter((suite) => (suite.form ?? "destructured") === form)
        .map((suite) => parityModule(suite).components[0]!.propsParameter?.form);
    expect(new Set(forms("destructured"))).toEqual(new Set(["destructured", undefined]));
    expect(new Set(forms("object"))).toEqual(new Set(["object"]));
  });

  it("namespace each case's props by its index, keeping explicit undefined", () => {
    const [a, b] = sourceCases([
      { name: "a", params: "{ s }: { s?: string }", jsx: "<p>{s}</p>", props: { s: undefined } },
      { name: "b", params: "{ s }: { s: string }", jsx: "<p>{s}</p>", props: { s: "x" } },
    ]);
    const suite = { title: "two", cases: [a!, b!] };
    const props = parityProps(suite);
    expect(props).toEqual({ c0S: undefined, c1S: "x" });
    expect(Object.keys(props)).toEqual(["c0S", "c1S"]);
    expect(parityModule(suite).components[0]!.props.map(({ name }) => name)).toEqual([
      "c0S",
      "c1S",
    ]);
  });

  it("refuse what would test nothing", () => {
    expect(() => sourceCases([{ name: "bad", jsx: "<p>{window}</p>" }])).toThrow(
      /does not accept the case bad:\n {2}UF3020/,
    );
    expect(() => sourceCases([{ name: "extra", jsx: "<p>x</p>", props: { s: "x" } }])).toThrow(
      "`s` is no prop",
    );
    expect(() =>
      sourceCases([{ name: "missing", params: "{ s }: { s: string }", jsx: "<p>{s}</p>" }]),
    ).toThrow("the required prop `s` has no value");
    expect(lowerSources([{ name: "bad", jsx: "<p>{window}</p>" }], "drop")).toEqual([undefined]);
  });

  it("refuse suites that cannot be one component", () => {
    const [source] = sourceCases([{ name: "a", jsx: "<p>a</p>" }]);
    const [defaulted] = sourceCases([
      { name: "d", params: '{ s = "x" }: { s?: string }', jsx: "<p>{s}</p>" },
    ]);
    const statics: ParityCase = { name: "s", render: el("p") };
    expect(() => parityModule({ title: "mixed", cases: [source!, statics] })).toThrow(
      "all source cases or all static ones",
    );
    expect(() => parityModule({ title: "roots", root: "self", cases: [source!, source!] })).toThrow(
      "exactly one case",
    );
    expect(() => parityModule({ title: "object", form: "object", cases: [defaulted!] })).toThrow(
      "cannot give `s` a default",
    );
  });
});

describe("jsLiteral", () => {
  it("writes what JSON cannot", () => {
    const value = { a: undefined, b: -0, c: Number.NaN, d: [Infinity, -Infinity, 1e21], e: null };
    const code = jsLiteral(value);
    expect(code).toBe(
      '{ "a": undefined, "b": -0, "c": NaN, "d": [Infinity, -Infinity, 1e+21], "e": null }',
    );
    const read = new Function(`return (${code});`)() as typeof value;
    expect(Object.is(read.b, -0)).toBe(true);
    expect(read).toEqual(value);
    expect("a" in read).toBe(true);
  });
});

/** Whether a node is a list or holds one. */
function holdsList(node: RenderNode): boolean {
  return node.kind === "For" || (node.kind === "Element" && node.children.some(holdsList));
}

/** Every attribute and node of a component, and the expressions they hold, with its props. */
function features(cases: readonly ParityCase[]): Set<string> {
  const found = new Set<string>();
  for (const { lowered } of cases) {
    const { component, props } = lowered!;
    const values = Object.values(props).flatMap(function flat(value: unknown): unknown[] {
      return Array.isArray(value)
        ? [value, ...value.flatMap(flat)]
        : value && typeof value === "object"
          ? [value, ...Object.values(value).flatMap(flat)]
          : [value];
    });
    if (values.some((value) => Number.isNaN(value))) found.add("NaN");
    if (values.some((value) => Object.is(value, -0))) found.add("-0");
    if (values.includes(1e21)) found.add("1e21");
    if (values.includes(null)) found.add("null");
    if (values.some((value) => Array.isArray(value) && !value.length)) found.add("an empty list");
    for (const prop of component.props) {
      if (prop.default) found.add("a default");
      if (!(prop.name in props)) found.add("an absent prop");
      else if (props[prop.name] === undefined) found.add("an explicit undefined");
    }
    const falsy = (expression: Expression | undefined) => {
      const value = expression && props[expression.code];
      return value === 0 || value === "" || Number.isNaN(value);
    };
    walk(component.render, {
      enter(node) {
        if (node.kind === "Fragment") found.add("a root fragment");
        if (node.kind === "Interpolation") found.add("an interpolation");
        if (node.kind === "If") {
          found.add("a conditional");
          if (node.branches.length >= 3) found.add("an else-if chain");
          if (node.branches.some(({ children }) => !children.length)) found.add("an empty branch");
          if (node.branches.some(({ children }) => children.length > 1))
            found.add("a multi-node branch");
          if (node.branches.some(({ children }) => children[0]?.kind === "Text"))
            found.add("a text branch");
          if (node.branches.some(({ condition }) => falsy(condition)))
            found.add("a falsy non-boolean condition");
        }
        if (node.kind === "For") {
          found.add("a list");
          if (node.index) found.add("an indexed list");
          if (node.body.children.some(holdsList)) found.add("a nested list");
        }
        if (node.kind !== "Element") return;
        if (node.tag === "svg") found.add("an svg");
        if (node.tag !== node.tag.toLowerCase()) found.add("a camel-case SVG element");
        for (const attribute of node.attributes as Attribute[]) {
          found.add(`a ${attribute.kind} attribute`);
          if (attribute.kind === "Class") {
            for (const item of attribute.items) found.add(`a ${item.kind} class item`);
          }
          if (attribute.kind === "Style") {
            for (const declaration of attribute.declarations) {
              found.add(`a ${declaration.kind} style declaration`);
            }
          }
          if (attribute.kind === "Spread") {
            if (attribute.keys.some(({ name }) => name === "class")) found.add("a spread class");
            if (!(attribute.value.code in props)) found.add("an absent spread");
          }
        }
      },
    });
  }
  return found;
}

describe("the seeded random components", () => {
  it("are deterministic: a seed always gives the same component", () => {
    expect(fuzzSource(7)).toEqual(fuzzSource(7));
    expect(fuzzSource(7)).not.toEqual(fuzzSource(8));
    expect(fuzzSource(7, { form: "object" })).not.toEqual(fuzzSource(7));
    expect(fuzzSource(7, { root: true })).not.toEqual(fuzzSource(7));
  });

  it("take no default when read through a props object", () => {
    for (const seed of FUZZ_SOURCE_SEEDS) {
      expect(fuzzSource(seed, { form: "object" }).params ?? "", String(seed)).not.toMatch(/ = /);
    }
  });

  it("are as varied as the printers' hard parts", () => {
    const suites = sourceSuites();
    const fuzzed = suites.filter(({ title }) => title.startsWith("seeded random components"));
    const found = features(fuzzed.flatMap(({ cases }) => cases));
    expect([...found].toSorted()).toEqual(
      [
        "-0",
        "1e21",
        "NaN",
        "a Bound attribute",
        "a Bound style declaration",
        "a Class attribute",
        "a Dynamic class item",
        "a Spread attribute",
        "a Static attribute",
        "a Static class item",
        "a Static style declaration",
        "a Style attribute",
        "a Toggle class item",
        "a camel-case SVG element",
        "a conditional",
        "a default",
        "a falsy non-boolean condition",
        "a list",
        "a multi-node branch",
        "a nested list",
        "a spread class",
        "a text branch",
        "an absent prop",
        "an absent spread",
        "an else-if chain",
        "an empty branch",
        "an empty list",
        "an explicit undefined",
        "an indexed list",
        "an interpolation",
        "an svg",
        "null",
      ].toSorted(),
    );
    const roots = suites.filter(({ title }) => title.startsWith("the root: seed"));
    expect(roots).toHaveLength(ROOT_SOURCE_SEEDS.length);
    expect(features(roots.flatMap(({ cases }) => cases))).toContain("a root fragment");
  });

  it("start no <pre> or <textarea> with a line feed", () => {
    for (const suite of sourceSuites()) {
      for (const parityCase of suite.cases) {
        const check = (nodes: readonly unknown[]): void => {
          for (const node of nodes) {
            if (typeof node !== "object" || node === null) continue;
            const { tag, children } = node as DomElement;
            if (tag === "pre" || tag === "textarea") {
              const [first] = children;
              expect(typeof first === "string" && first.startsWith("\n"), parityCase.name).toBe(
                false,
              );
            }
            check(children);
          }
        };
        check(expectedNodes(parityCase));
      }
    }
  });
});

describe("the tricky components", () => {
  it("name every case once", () => {
    const names = TRICKY_SOURCES.map(({ name }) => name);
    expect(new Set(names).size).toBe(names.length);
  });
});
