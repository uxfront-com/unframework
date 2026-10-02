import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";

import { generateSchema } from "../scripts/generate-schema.ts";
import {
  ATTRIBUTE_KINDS,
  createComponent,
  createElement,
  createExport,
  createModule,
  createStaticAttribute,
  createText,
  irSchema,
  RENDER_NODE_KINDS,
  span,
  validateModule,
} from "../src/index.ts";

describe("irSchema", () => {
  it("is up to date with the IR's types", () => {
    expect(`${JSON.stringify(irSchema, null, 2)}\n`).toBe(generateSchema());
  }, 30_000);

  const validate = new Ajv({ allErrors: true, strict: true }).compile(irSchema);

  it("accepts a module built with the builders", () => {
    const at = span(0, 1);
    const module = createModule("Hello.uf.tsx", [
      { name: "Hello", span: at, render: createElement("p", [], [], at) },
    ]);
    expect(validate(module), JSON.stringify(validate.errors)).toBe(true);
  });

  it("rejects unknown fields, so a field is never added without a schema change", () => {
    const module = { ...createModule("Hello.uf.tsx"), extra: true };
    expect(validate(module)).toBe(false);
  });

  it("rejects an unknown node kind", () => {
    const at = span(0, 1);
    const render = { kind: "Unknown", span: at };
    const module = createModule("Hello.uf.tsx", [
      { name: "Hello", span: at, render: render as never },
    ]);
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
        message: "must match one of ElementNode, TextNode",
      },
    ]);
  });

  it("points at what is wrong", () => {
    const module = structuredClone(valid()) as unknown as Record<string, unknown>;
    render(module).tag = 1;
    expect(validateModule(module)).toEqual([
      { path: "/components/0/render/tag", message: "must be string" },
    ]);
  });
});
