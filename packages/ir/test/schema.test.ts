import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";

import { generateSchema } from "../scripts/generate-schema.ts";
import {
  ATTRIBUTE_KINDS,
  BINDING_KINDS,
  createBranch,
  createComponent,
  createElement,
  createExport,
  createFor,
  createFragment,
  createIf,
  createModule,
  createStaticAttribute,
  createText,
  irSchema,
  RENDER_NODE_KINDS,
  span,
  validateModule,
} from "../src/index.ts";
import type { ElementNode, RenderNode } from "../src/index.ts";
import { everyKind, expression, ids } from "./fixtures.ts";

describe("irSchema", () => {
  it("is up to date with the IR's types", () => {
    expect(`${JSON.stringify(irSchema, null, 2)}\n`).toBe(generateSchema());
  }, 30_000);

  const validate = new Ajv({ allErrors: true, strict: true }).compile(irSchema);

  it("accepts a module built with the builders", () => {
    const at = span(0, 1);
    const module = createModule("Hello.uf.tsx", [
      createComponent("Hello", createElement("p", [], [], at), at),
    ]);
    expect(validate(module), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(everyKind()), JSON.stringify(validate.errors)).toBe(true);
  });

  it("rejects unknown fields, so a field is never added without a schema change", () => {
    const module = { ...createModule("Hello.uf.tsx"), extra: true };
    expect(validate(module)).toBe(false);
  });

  it("rejects an unknown node kind", () => {
    const at = span(0, 1);
    const render = { kind: "Unknown", span: at };
    const module = createModule("Hello.uf.tsx", [createComponent("Hello", render as never, at)]);
    expect(validate(module)).toBe(false);
  });
});

/** The `kind` constants of a union definition in the schema. */
function kindsOf(definition: string): string[] {
  const definitions = irSchema.definitions as Record<string, Record<string, unknown>>;
  const branches = (definitions[definition]!.anyOf as { $ref: string }[] | undefined) ?? [
    { $ref: definitions[definition]!.$ref as string },
  ];
  return branches.map(({ $ref }) => {
    const target = definitions[$ref.split("/").at(-1)!]!;
    return (target.properties as { kind: { const: string } }).kind.const;
  });
}

// The coverage gate iterates these lists; a kind missing from them would never need a case.
describe("the kind lists", () => {
  it("name every render node kind in the schema", () => {
    expect([...RENDER_NODE_KINDS].sort()).toEqual(kindsOf("RenderNode").sort());
  });

  it("name every attribute kind in the schema", () => {
    expect([...ATTRIBUTE_KINDS].sort()).toEqual(kindsOf("Attribute").sort());
  });

  it("name every binding kind in the schema", () => {
    const definitions = irSchema.definitions as Record<string, { enum?: string[] }>;
    expect([...BINDING_KINDS].sort()).toEqual([...definitions.BindingKind!.enum!].sort());
  });
});

describe("validateModule", () => {
  const ajv = new Ajv({ allErrors: true, strict: true }).compile(irSchema);
  const at = span(0, 1);
  const valid = () =>
    createModule(
      "Hello.uf.tsx",
      [
        createComponent(
          "Hello",
          createElement(
            "p",
            [createStaticAttribute("class", "a", at), createStaticAttribute("hidden", true, at)],
            [createText("Hi", at), createElement("br", [], [], at)],
            at,
          ),
          at,
        ),
      ],
      [createExport("default", "Hello", at)],
    );
  const render = (module: Record<string, unknown>) =>
    (module.components as Record<string, unknown>[])[0]!.render as Record<string, unknown>;

  // Each sample is a valid module with one change; validateModule must agree with Ajv on all.
  const samples: [string, (module: Record<string, unknown>) => unknown][] = [
    ["a valid module", (module) => module],
    ["a module with an unknown field", (module) => ({ ...module, extra: true })],
    [
      "a module without components",
      (module) =>
        Object.fromEntries(Object.entries(module).filter(([key]) => key !== "components")),
    ],
    ["the wrong IR version", (module) => ({ ...module, irVersion: 2 })],
    ["components that are not an array", (module) => ({ ...module, components: {} })],
    ["an unknown node kind", (module) => ((render(module).kind = "Unknown"), module)],
    ["a tag that is not a string", (module) => ((render(module).tag = 1), module)],
    // Targets map tags and attribute names by their lower-case HTML spelling.
    ["a tag in upper case", (module) => ((render(module).tag = "DIV"), module)],
    ["a custom element", (module) => ((render(module).tag = "my-element"), module)],
    [
      "an attribute name in camel case",
      (module) => (
        ((render(module).attributes as { name: unknown }[])[0]!.name = "readOnly"),
        module
      ),
    ],
    [
      "an attribute name with a space",
      (module) => (((render(module).attributes as { name: unknown }[])[0]!.name = "a b"), module),
    ],
    [
      "an attribute value of false",
      (module) => (((render(module).attributes as { value: unknown }[])[1]!.value = false), module),
    ],
    [
      "a text node without a value",
      (module) => (delete (render(module).children as Record<string, unknown>[])[0]!.value, module),
    ],
    ["a span of NaN", (module) => ((render(module).span = { start: Number.NaN, end: 1 }), module)],
    [
      "an export of an unknown kind",
      (module) => (((module.exports as { kind: string }[])[0]!.kind = "both"), module),
    ],
    ["null", () => null],
    ["an array", () => []],
    // Keys a prototype has: they must not find a schema there, or a value.
    ["a module with a field named constructor", (module) => ({ ...module, constructor: 1 })],
    ["a module with a field named toString", (module) => ({ ...module, toString: 1 })],
    [
      "a module with a field named __proto__",
      (module) => JSON.parse(JSON.stringify(module).replace(/^\{/, '{"__proto__":1,')) as unknown,
    ],
    [
      "a module whose file is inherited",
      ({ file, ...module }) => Object.setPrototypeOf(module, { file }) as unknown,
    ],
    // Holes, which `forEach` skips and Ajv checks as `undefined` (r3-analyzer-5).
    [
      "children with a hole",
      (module) => (((render(module).children as unknown[]).length = 3), module),
    ],
    [
      "attributes with a deleted item",
      // oxlint-disable-next-line no-array-delete -- the hole it leaves is the point.
      (module) => (delete (render(module).attributes as unknown[])[0], module),
    ],
    [
      "components that are a sparse array",
      (module) => ({ ...module, components: Object.assign([], { length: 1 }) }),
    ],
  ];

  it.each(samples)("agrees with Ajv on %s", (_, change) => {
    const value = change(structuredClone(valid()) as unknown as Record<string, unknown>);
    // JSON has no NaN, so Ajv sees what a JSON round trip would give.
    const json = JSON.parse(JSON.stringify(value)) as unknown;
    expect(validateModule(value).length === 0).toBe(ajv(json));
  });

  it("accepts the names HTML's vocabulary has", () => {
    const module = structuredClone(valid()) as unknown as Record<string, unknown>;
    render(module).tag = "h1";
    (render(module).attributes as { name: unknown }[])[0]!.name = "data-é.x_1";
    expect(validateModule(module)).toEqual([]);
  });

  it("checks a hole in an array as a missing item", () => {
    const module = structuredClone(valid()) as unknown as Record<string, unknown>;
    (render(module).children as unknown[]).length = 3;
    expect(validateModule(module)).toEqual([
      {
        path: "/components/0/render/children/2",
        message: "must match one of ElementNode, TextNode, InterpolationNode, IfNode, ForNode",
      },
    ]);
  });

  // The kinds M1 adds, each changed once; validateModule must agree with Ajv on all.
  type Json = Record<string, unknown>;
  const component = (module: Json) => (module.components as Json[])[0]!;
  const roots = (module: Json) => (component(module).render as { children: Json[] }).children;
  const card = (module: Json) => roots(module)[0]!;
  const list = (module: Json) => roots(module)[1]! as { branches: Json[] };
  const loop = (module: Json) =>
    ((list(module).branches[0]!.children as Json[])[0]!.children as Json[])[0]!;
  const attribute = (module: Json, index: number) => (card(module).attributes as Json[])[index]!;
  const kindSamples: [string, (module: Json) => unknown][] = [
    ["a module with every kind", (module) => module],
    ["a module without types", ({ types: _types, ...module }) => module],
    [
      "a fragment among the children",
      (module) => (roots(module).push(structuredClone(component(module).render) as Json), module),
    ],
    [
      "an if branch whose condition is a string",
      (module) => ((list(module).branches[0]!.condition = "x"), module),
    ],
    ["a list without a key", (module) => (delete loop(module).key, module)],
    ["a list item that is not a binding id", (module) => ((loop(module).item = "item"), module)],
    [
      "a list body that is text",
      (module) => ((loop(module).body = { kind: "Text", value: "x", span: span(0, 1) }), module),
    ],
    [
      "a class part of an unknown kind",
      (module) => (((attribute(module, 0).items as Json[])[0]!.kind = "Name"), module),
    ],
    [
      "a static style value that is a number",
      (module) => (((attribute(module, 1).declarations as Json[])[0]!.value = 1), module),
    ],
    [
      "a spread key without a span",
      (module) => (delete (attribute(module, 3).keys as Json[])[0]!.span, module),
    ],
    [
      "a reference of an unknown kind",
      (module) => (
        (((attribute(module, 2).value as Json).refs as Json[])[0]!.kind = "Local"),
        module
      ),
    ],
    [
      "a shorthand that is false",
      (module) => (
        (((attribute(module, 2).value as Json).refs as Json[])[0]!.shorthand = false),
        module
      ),
    ],
    [
      "a prop whose optional is a string",
      (module) => (((component(module).props as Json[])[0]!.optional = "no"), module),
    ],
    [
      "a props parameter of an unknown form",
      (module) => (((component(module).propsParameter as Json).form = "rest"), module),
    ],
    [
      "a binding of an unknown kind",
      (module) => (((component(module).bindings as Json[])[0]!.kind = "state"), module),
    ],
    [
      "a binding id without an offset",
      (module) => (((component(module).bindings as Json[])[0]!.id = "label"), module),
    ],
    ["a tag in camel case", (module) => ((card(module).tag = "linearGradient"), module)],
    ["a tag with a hyphen", (module) => ((card(module).tag = "font-face"), module)],
    [
      "an attribute name in camel case",
      (module) => ((attribute(module, 2).name = "viewBox"), module),
    ],
    // A key set to `undefined` is absent, in JSON and in Ajv: optional ones may be, required
    // ones may not.
    [
      "an optional key set to undefined",
      (module) => ((list(module).branches[1]!.condition = undefined), module),
    ],
    ["a list's index set to undefined", (module) => ((loop(module).index = undefined), module)],
    ["a required key set to undefined", (module) => ((card(module).children = undefined), module)],
    ["an unknown key set to undefined", (module) => ((card(module).extra = undefined), module)],
  ];

  it.each(kindSamples)("agrees with Ajv on %s", (_, change) => {
    const value = change(structuredClone(everyKind()) as unknown as Json);
    const json = JSON.parse(JSON.stringify(value)) as unknown;
    expect(validateModule(value).length === 0).toBe(ajv(json));
  });

  // r-ir-analyzer: an identity or canary hook copies nodes with optional keys left undefined.
  it("reads a key set to undefined as absent, as a JSON round trip does", () => {
    const module = everyKind();
    const copy = structuredClone(module) as unknown as Json;
    Object.assign(component(copy), { propsParameter: undefined });
    Object.assign(list(copy).branches[0]!, {
      condition: { ...(list(copy).branches[0]!.condition as Json), extra: undefined },
    });
    expect(validateModule(copy)).toEqual([]);
    Object.assign(card(copy), { children: undefined });
    expect(validateModule(copy)).toEqual([
      { path: "/components/0/render/children/0", message: 'must have "children"' },
    ]);
  });

  // The `kind` fast path: a node is checked against the branch of its kind only, so a node whose
  // kind comes late in its union costs the same at any depth (map-ir §6.3).
  it("validates deeply nested control flow in linear time", () => {
    let node: RenderNode = createText("x", at);
    for (let depth = 0; depth < 60; depth++) {
      const body: ElementNode = createElement("li", [], [node], at);
      node =
        depth % 2
          ? createIf([createBranch(expression("tone", 0, [["tone", ids.tone]]), [body], at)], at)
          : createFor(expression("items", 0), ids.item, expression("item", 0), body, at);
    }
    const module = createModule("Deep.uf.tsx", [
      createComponent("Deep", createFragment([node], at), at),
    ]);
    const started = performance.now();
    expect(validateModule(module)).toEqual([]);
    expect(performance.now() - started).toBeLessThan(500);
    // An unknown kind deep down is still reported once, with every branch named.
    let deepest = module.components[0]!.render as unknown as Json;
    while ((deepest.children ?? deepest.branches ?? deepest.body) !== undefined) {
      deepest =
        (deepest.children as Json[] | undefined)?.[0] ??
        ((deepest.branches as Json[] | undefined)?.[0]?.children as Json[] | undefined)?.[0] ??
        (deepest.body as Json);
    }
    deepest.kind = "Unknown";
    const errors = validateModule(module);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe(
      "must match one of ElementNode, TextNode, InterpolationNode, IfNode, ForNode",
    );
  });

  it("points at what is wrong", () => {
    const module = structuredClone(valid()) as unknown as Record<string, unknown>;
    render(module).tag = 1;
    expect(validateModule(module)).toEqual([
      { path: "/components/0/render/tag", message: "must be string" },
    ]);
  });
});
