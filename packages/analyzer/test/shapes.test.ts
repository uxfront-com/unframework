import { checkInvariants } from "@unframework/ir";
import type { UfModule } from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import { createSyntacticOracle } from "@unframework/type-oracle";
import type { TypeShape } from "@unframework/type-oracle";
import { describe, expect, it } from "vitest";

import { analyze, shapeQueries } from "../src/index.ts";
import type { AnalyzeResult } from "../src/index.ts";
import { codes, only, problems, run } from "./helpers.ts";

/**
 * Analyses `A.uf.tsx` as `compile()` does (ADR-0067): it asks a syntactic oracle over the
 * files for the shape of every type `shapeQueries` names, and hands the shapes to `analyze`.
 */
async function analyzeWith(files: Record<string, string>): Promise<AnalyzeResult> {
  const parsed = parseModule("A.uf.tsx", files["A.uf.tsx"]!);
  const oracle = createSyntacticOracle({
    root: "/project",
    readFile: async (path) => files[path.slice("/project/".length)],
  });
  const shapes = new Map<string, TypeShape>();
  for (const query of shapeQueries(parsed)) {
    shapes.set(`${query.span.start}:${query.span.end}`, await oracle.resolveShape(query));
  }
  const result = analyze(parsed, { shapes: (span) => shapes.get(`${span.start}:${span.end}`) });
  if (result.module) expect(checkInvariants(result.module)).toEqual([]);
  return result;
}

const TYPES = [
  "interface Hidden { id: string }",
  "export interface Base extends Hidden { tone?: Tone }",
  'export type Tone = "info" | "danger";',
  "export interface ButtonProps extends Base { label: string; disabled?: boolean }",
].join("\n");

describe("shapeQueries", () => {
  it("names each type an API is declared by, and setup types that name an import", () => {
    const source = [
      'import type { Item } from "./types.ts";',
      'import { defineEmits, defineModel, defineSlots, ref } from "unframework";',
      'import type { InjectionKey } from "unframework";',
      "export const Key: InjectionKey<Item> = Symbol();",
      "interface P { a: string }",
      "export function A(props: P) {",
      "  const emit = defineEmits<{ pick: [item: Item] }>();",
      "  const open = defineModel<boolean>();",
      "  defineSlots<{ default(): unknown }>();",
      "  const item = ref<Item | null>(null);",
      "  const count = ref<number>(0);",
      "  return <p />;",
      "}",
    ].join("\n");
    const queries = shapeQueries(parseModule("A.uf.tsx", source));
    expect(queries.map(({ span }) => source.slice(span.start, span.end))).toEqual([
      "InjectionKey<Item>",
      "Item",
      "P",
      "{ pick: [item: Item] }",
      "boolean",
      "{ default(): unknown }",
      "Item | null",
    ]);
    expect(queries.every(({ file }) => file === "A.uf.tsx")).toBe(true);
  });
});

describe("props types read through the type oracle", () => {
  it("accepts an imported props type, with each member's declaring file and declaration", async () => {
    const files = {
      "types.ts": TYPES,
      "A.uf.tsx": [
        'import type { ButtonProps } from "./types.ts";',
        "export function A({ label, tone }: ButtonProps) {",
        "  return <p class={tone}>{label}</p>;",
        "}",
      ].join("\n"),
    };
    const { module, diagnostics } = await analyzeWith(files);
    expect(diagnostics).toEqual([]);
    const a = only(module);
    const annotation = files["A.uf.tsx"].indexOf("ButtonProps)");
    const at = { start: annotation, end: annotation + "ButtonProps".length };
    expect(
      a.props.map(({ name, optional, type, span, declaredBy }) => [
        name,
        optional,
        type,
        span,
        declaredBy && [declaredBy.file, declaredBy.declaration],
      ]),
    ).toEqual([
      ["label", false, { code: "string", span: at }, at, ["types.ts", "ButtonProps"]],
      ["disabled", true, { code: "boolean", span: at }, at, ["types.ts", "ButtonProps"]],
      ["tone", true, { code: "Tone", span: at }, at, ["types.ts", "Base"]],
      ["id", false, { code: "string", span: at }, at, ["types.ts", "Hidden"]],
    ]);
    const { declaredBy } = a.props[0]!;
    expect(TYPES.slice(declaredBy!.span.start, declaredBy!.span.end)).toBe("label: string;");
    expect(module!.typeImports).toEqual([
      {
        specifier: "./types.ts",
        names: [{ imported: "ButtonProps", local: "ButtonProps", span: expect.any(Object) }],
        span: { start: 0, end: files["A.uf.tsx"].indexOf("\n") },
      },
    ]);
    // A type the module imports is not one it declares: no output copies it.
    expect(a.types).toEqual([]);
  });

  it("accepts `extends`, an intersection and a utility type of the module's own types", async () => {
    const source = [
      "interface Base { id: string; tone?: string }",
      "interface P extends Base { label: string }",
      'type Q = Pick<Base, "tone"> & { size: number };',
      "export function A(props: P) { return <p>{props.label}</p>; }",
      "export function B(props: Q) { return <p>{props.size}</p>; }",
    ].join("\n");
    const { module, diagnostics } = await analyzeWith({ "A.uf.tsx": source });
    expect(diagnostics).toEqual([]);
    const [a, b] = module!.components;
    const text = (prop: { span: { start: number; end: number } }) =>
      source.slice(prop.span.start, prop.span.end);
    expect(a!.props.map((prop) => [prop.name, text(prop), prop.declaredBy?.declaration])).toEqual([
      ["label", "label: string", undefined],
      ["id", "id: string;", "Base"],
      ["tone", "tone?: string", "Base"],
    ]);
    expect(b!.props.map((prop) => [prop.name, prop.declaredBy?.declaration])).toEqual([
      ["tone", "Base"],
      ["size", undefined],
    ]);
    // Each output copies the declarations the props reach, the extended one too.
    expect(a!.types).toEqual(["Base", "P"]);
    expect(b!.types).toEqual(["Base", "Q"]);
  });

  it("reads an imported prop's kinds from its shape", async () => {
    const files = {
      "types.ts": "export interface P { flag?: boolean | string }",
      "A.uf.tsx":
        'import type { P } from "./types.ts";\nexport function A(props: P) { return <p />; }',
    };
    const { diagnostics } = await analyzeWith(files);
    // Vue reads `""` as `true` (ADR-0034), reported at the one span this module holds.
    expect(problems(files["A.uf.tsx"], diagnostics)).toEqual(["UF1002 P"]);
    expect(diagnostics[0]!.message).toContain("both a boolean and any string");
  });

  it.each([
    [
      "a module that does not exist",
      {
        "A.uf.tsx":
          'import type { P } from "./missing.ts";\nexport function A(props: P) { return <p />; }',
      },
      "UF6001 P",
      "`P` cannot be resolved: the type oracle cannot read the module it is imported from.",
    ],
    [
      "a type the module does not export",
      {
        "types.ts": "interface P { a: string }",
        "A.uf.tsx":
          'import type { P } from "./types.ts";\nexport function A(props: P) { return <p />; }',
      },
      "UF6001 P",
      "`P` cannot be resolved: the module it is imported from does not export it.",
    ],
    [
      "a construct of another file the oracle cannot evaluate",
      {
        "types.ts": 'export type P = { [K in "a" | "b"]: string };',
        "A.uf.tsx":
          'import type { P } from "./types.ts";\nexport function A(props: P) { return <p />; }',
      },
      "UF6002 P",
      '`{ [K in "a" | "b"]: string }` in `types.ts` needs a type checker to evaluate, and the default type oracle reads types as written.',
    ],
    [
      "a member of another file whose type is a function",
      {
        "types.ts": "export interface P { onPick: () => void }",
        "A.uf.tsx":
          'import type { P } from "./types.ts";\nexport function A(props: P) { return <p />; }',
      },
      // A failing member stops no other member's checks: `onPick` is reserved too.
      ["UF1002 P", "UF2003 P"],
      "Function types are not supported in props: a callback is an event, which a component declares with `defineEmits` (ADR-0047), and a render function is a slot (`defineSlots`).",
    ],
    [
      "members two files give different types",
      {
        "types.ts": "export interface L { x: string }",
        "A.uf.tsx": [
          'import type { L } from "./types.ts";',
          "interface C { x: number }",
          "export function A(props: L & C) { return <p />; }",
        ].join("\n"),
      },
      "UF6005 L & C",
      "`x` is declared with different types or optionality by `L` and `C`: the targets declare each prop once, with one type.",
    ],
    [
      "a type another file declares without `export`",
      {
        "types.ts": "interface Item { id: string }\nexport interface P { item: Item }",
        "A.uf.tsx":
          'import type { P } from "./types.ts";\nexport function A(props: P) { return <p />; }',
      },
      "UF6003 P",
      "`item`'s type names `Item`, which `types.ts` declares without `export`: an output that writes the prop's type cannot import it.",
    ],
  ])("reports %s", async (_, files, problem, message) => {
    const { module, diagnostics } = await analyzeWith(files as Record<string, string>);
    expect(problems(files["A.uf.tsx"], diagnostics)).toEqual([problem].flat());
    expect(diagnostics[0]!.message).toBe(message);
    expect(module?.components ?? []).toEqual([]);
  });

  it("reports an imported props type when it is given no shapes (UF6001)", () => {
    const source =
      'import type { P } from "./types.ts";\nexport function A(props: P) { return <p />; }';
    const { diagnostics } = run(source);
    expect(problems(source, diagnostics)).toEqual(["UF6001 P"]);
    expect(diagnostics[0]!.help).toContain("compile()");
  });

  it("accepts a utility type of a local object without shapes", () => {
    const source = "export function A(props: Partial<{ a: string }>) { return <p />; }";
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(only(module).props.map(({ name, optional }) => [name, optional])).toEqual([["a", true]]);
  });
});

/** Each type export of a module, as one line. */
const exports = (module: UfModule | undefined) =>
  module?.typeExports?.map((entry) =>
    entry.kind === "ReExport"
      ? `${entry.specifier}: ${entry.names.map((name) => `${name.imported} as ${name.exported}`).join(", ")}`
      : `${entry.name}: ${entry.code}`,
  );

describe("type exports", () => {
  it("records re-exports and the exported types no component reaches", () => {
    const source = [
      'export type { Tone, Size as Scale } from "./types.ts";',
      'export { type Item } from "./item.ts";',
      'export type Shade = "light" | "dark";',
      "export function A() { return <p />; }",
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(exports(module)).toEqual([
      "./types.ts: Tone as Tone, Size as Scale",
      "./item.ts: Item as Item",
      'Shade: type Shade = "light" | "dark";',
    ]);
  });

  it("exports a local type that an export list names, as its declaration would", () => {
    const source = [
      'type Shade = "light" | "dark";',
      "interface P { shade: Shade }",
      "export type { Shade, P };",
      "export function A(props: P) { return <p />; }",
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(module!.types.map(({ name, exported }) => [name, exported])).toEqual([
      ["Shade", true],
      ["P", true],
    ]);
    expect(
      codes(
        run("type T = string;\nexport type { T as U };\nexport function A() { return <p />; }")
          .diagnostics,
      ),
    ).toEqual(["UF1002", "UF1002"]);
  });
});

describe("a spread of a setup value whose type is imported", () => {
  it("renders the keys of the shape the type oracle resolves", async () => {
    const source = [
      'import { ref } from "unframework";',
      'import type { Attrs } from "./types.ts";',
      'export function A() { const attrs = ref<Attrs>({ id: "a" }); const more: Attrs = { id: "b" }; return <p {...attrs.value}><a {...more}>x</a></p>; }',
    ].join("\n");
    const { module, diagnostics } = await analyzeWith({
      "types.ts": "export interface Attrs { id: string; title?: string }",
      "A.uf.tsx": source,
    });
    expect(diagnostics).toEqual([]);
    const spreads = JSON.stringify(only(module).render).match(/"keys":\[[^\]]*\]/g);
    expect(
      spreads?.map((keys) => [...keys.matchAll(/"name":"(\w+)"/g)].map(([, name]) => name)),
    ).toEqual([
      ["id", "title"],
      ["id", "title"],
    ]);
  });

  it("renders the keys a local interface inherits from an imported one", async () => {
    const source = [
      'import type { Base } from "./types.ts";',
      "export interface Attrs extends Base { id: string }",
      'export function A() { const attrs: Attrs = { id: "a", title: "b" }; return <p {...attrs}>x</p>; }',
    ].join("\n");
    const { module, diagnostics } = await analyzeWith({
      "types.ts": "export interface Base { title: string }",
      "A.uf.tsx": source,
    });
    expect(diagnostics).toEqual([]);
    expect(JSON.stringify(only(module).render)).toMatch(/"keys":\[\{"name":"id".*"name":"title"/);
  });

  it.each([
    [
      "an unresolved base",
      'import type { M } from "./missing.ts";\nexport interface Attrs extends M { id: string; title?: string }',
    ],
    ["an index signature", "export interface Attrs { id: string; [key: string]: string }"],
    [
      "an intersection with a `Record`",
      "export type Attrs = { id: string } & Record<string, string>;",
    ],
  ])("reports a spread whose imported type holds %s (UF3048)", async (_, types) => {
    const source = [
      'import type { Attrs } from "./types.ts";',
      'export function A() { const attrs: Attrs = { id: "a" }; return <p {...attrs}>x</p>; }',
    ].join("\n");
    const { diagnostics } = await analyzeWith({ "types.ts": types, "A.uf.tsx": source });
    expect(problems(source, diagnostics)).toEqual(["UF3048 {...attrs}"]);
    expect(diagnostics[0]!.message).toContain("does not resolve in full");
  });

  it("points a problem with an imported key at the annotation", async () => {
    const source = [
      'import type { Attrs } from "./types.ts";',
      'export function A() { const attrs: Attrs = { key: "a" }; return <p {...attrs}>x</p>; }',
    ].join("\n");
    const { diagnostics } = await analyzeWith({
      "types.ts": "export interface Attrs { key: string }",
      "A.uf.tsx": source,
    });
    expect(problems(source, diagnostics)).toEqual(["UF3049 {...attrs}"]);
    const [related] = diagnostics[0]!.related!;
    expect(source.slice(related!.span.start, related!.span.end)).toBe("Attrs");
  });

  it("reports the keys as unknown without the shapes (UF3048)", () => {
    const source = [
      'import { ref } from "unframework";',
      'import type { Attrs } from "./types.ts";',
      'export function A() { const attrs = ref<Attrs>({ id: "a" }); return <p {...attrs.value}>x</p>; }',
    ].join("\n");
    expect(problems(source, run(source).diagnostics)).toEqual(["UF3048 {...attrs.value}"]);
  });
});

describe("the shape path's checks", () => {
  const imported = (members: string) => ({
    "types.ts": `export interface P { label: string; ${members} }`,
    "A.uf.tsx":
      'import type { P } from "./types.ts";\nexport function A(props: P) { return <p />; }',
  });

  it.each([
    ["a: any", "UF6002 P", "`any` is not a type a prop can take."],
    ["a: unknown", "UF6002 P", "`unknown` is not a type a prop can take."],
    ["a: [string, number]", "UF6002 P", "A tuple type is not a type a prop can take."],
    ["a: {}", "UF6002 P", "The empty object type `{}` is not a type a prop can take."],
    [
      "a: Date",
      "UF6001 P",
      "`Date` is neither declared nor imported by this module: the compiler reads no global type in a props type.",
    ],
  ])("reports the imported member %s", async (member, problem, message) => {
    const files = imported(member);
    const { module, diagnostics } = await analyzeWith(files);
    expect(problems(files["A.uf.tsx"], diagnostics)).toEqual([problem]);
    expect(diagnostics[0]!.message).toBe(message);
    expect(module?.components ?? []).toEqual([]);
  });

  it('reads literal kinds from the shape: a boolean beside `"mixed"` renders alike on Vue', async () => {
    const files = imported('pressed?: boolean | "mixed"; size?: 1 | 2');
    const { module, diagnostics } = await analyzeWith(files);
    expect(diagnostics).toEqual([]);
    expect(only(module).props.map(({ name }) => name)).toEqual(["label", "pressed", "size"]);
  });

  // A type that two components share is reported once, and fails both (P2).
  it.each([
    [
      "interface A { label: string; x: any }\nexport function One(p: Readonly<A>) { return <p />; }\nexport function Two(p: Partial<A>) { return <p />; }",
      ["UF6002 any"],
    ],
    [
      "interface B { label: string; cb: () => void }\ninterface A extends B {}\nexport function One(p: A) { return <p />; }\nexport function Two(p: Partial<A>) { return <p />; }",
      ["UF1002 () => void"],
    ],
  ])("fails every component that shares a bad shaped type: %j", async (source, expected) => {
    const { module, diagnostics } = await analyzeWith({ "A.uf.tsx": source });
    expect(problems(source, diagnostics)).toEqual(expected);
    expect(module?.components ?? []).toEqual([]);
  });

  it.each([
    "interface A { x: string }\ninterface P extends A { label: string; label: string }\nexport default function Badge(props: P) { return <p />; }",
    "type P = { label: string; label: string } & { x: number };\nexport default function Badge(props: P) { return <p />; }",
  ])("reports a member a shaped props type writes twice (UF2001): %j", async (source) => {
    const { module, diagnostics } = await analyzeWith({ "A.uf.tsx": source });
    expect(codes(diagnostics)).toEqual(["UF2001"]);
    const [problem] = diagnostics;
    expect(source.slice(problem!.span.start, problem!.span.end)).toBe("label");
    expect(problem!.span.start).toBe(source.lastIndexOf("label"));
    expect(module?.components ?? []).toEqual([]);
  });

  it.each([
    [
      "an override of another type",
      "interface L { a: string }\ninterface P extends L { a: number }",
      "P",
      "`L`",
    ],
    [
      "an override that is optional",
      "interface L { a: string }\ninterface P extends L { a?: string }",
      "P",
      "`L`",
    ],
    [
      "intersection parts of other optionality",
      "interface L { a: string }\ninterface Q { a?: string }\ntype P = L & Q;",
      "P",
      "`L` and `Q`",
    ],
    [
      "a narrowing override",
      'interface L { a: string }\ninterface P extends L { a: "sm" | "md" }',
      "P",
      "`L`",
    ],
  ])("reports %s (UF6005)", async (_, types, at, by) => {
    const source = `${types}\nexport function C(props: P) { return <p />; }`;
    const { module, diagnostics } = await analyzeWith({ "A.uf.tsx": source });
    expect(problems(source, diagnostics)).toEqual([`UF6005 ${at}`]);
    expect(diagnostics[0]!.message).toContain(
      "`a` is declared with different types or optionality by",
    );
    expect(diagnostics[0]!.message).toContain(by);
    expect(module?.components ?? []).toEqual([]);
  });

  it("accepts an override of the same type, and a member's own object that shares a name", async () => {
    const source = [
      "interface Item { a: number }",
      "interface L { a: string }",
      "interface P extends L { a: string; item: Item }",
      "export function C(props: P) { return <p />; }",
    ].join("\n");
    const { module, diagnostics } = await analyzeWith({ "A.uf.tsx": source });
    expect(diagnostics).toEqual([]);
    expect(only(module).props.map(({ name }) => name)).toEqual(["a", "item"]);
  });
});

// UF6005's parts are what the props type is written from: an interface's `extends` list and an
// intersection's operands, through aliases and utility types.
describe("the parts UF6005 compares", () => {
  it.each([
    [
      "a base that is also a member's type",
      "interface L { a: string }\ninterface P extends L { a: number; child?: L }",
    ],
    [
      "a base that is a list's element",
      "interface L { a: string }\ninterface P extends L { a: number; kids: L[] }",
    ],
    [
      "a base built with `Partial`",
      "interface L { a: string }\ninterface P extends Partial<L> { a: number }",
    ],
    [
      "a base built with `Pick`",
      'interface L { a: string }\ninterface P extends Pick<L, "a"> { a: number }',
    ],
    [
      "a required override of a `Partial` base",
      "interface L { a: string }\ninterface P extends Partial<L> { a: string }",
    ],
    [
      "an optional part written in place",
      "interface L { a: string }\ntype P = L & { a?: string };",
    ],
  ])("reports %s (UF6005)", async (_, types) => {
    const source = `${types}\nexport function C(props: P) { return <p />; }`;
    const { module, diagnostics } = await analyzeWith({ "A.uf.tsx": source });
    expect(problems(source, diagnostics)).toEqual(["UF6005 P"]);
    expect(diagnostics[0]!.message).toContain(
      "`a` is declared with different types or optionality",
    );
    expect(module?.components ?? []).toEqual([]);
  });

  it("reports an override of an imported base (UF6005)", async () => {
    const source = [
      'import type { L } from "./types.ts";',
      "interface P extends L { a: number }",
      "export function C(props: P) { return <p />; }",
    ].join("\n");
    const { diagnostics } = await analyzeWith({
      "types.ts": "export interface L { a: string }",
      "A.uf.tsx": source,
    });
    expect(problems(source, diagnostics)).toEqual(["UF6005 P"]);
    expect(diagnostics[0]!.message).toBe(
      "`a` is declared with different types or optionality by `P` and `L`: the targets declare each prop once, with one type.",
    );
  });

  it.each([
    [
      "a member's object type written again in place",
      "interface Item { a: number }\ninterface A { a: string; item: Item }\ninterface P extends A { item: { a: number } }",
    ],
    [
      "an intersection with a member's object type written again in place",
      "interface Item { a: number }\ninterface A { a: string; item: Item }\ntype P = A & { item: { a: number } };",
    ],
    [
      "`boolean` over `true | false`",
      "interface A { a: boolean }\ninterface P extends A { a: true | false }",
    ],
    [
      "an optional member's `undefined`",
      "interface A { a?: string }\ninterface P extends A { a?: string | undefined }",
    ],
    [
      "a `Partial` part over an optional one",
      "interface L { a: string }\ntype P = Partial<L> & { a?: string };",
    ],
  ])("accepts %s", async (_, types) => {
    const source = `${types}\nexport function C(props: P) { return <p />; }`;
    const { module, diagnostics } = await analyzeWith({ "A.uf.tsx": source });
    expect(diagnostics).toEqual([]);
    expect(only(module).name).toBe("C");
  });
});

describe("UF6005 through utility types", () => {
  it.each([
    [
      "a `Pick` whose keys are an alias",
      'interface L { a: string; b: number }\ntype K = "a";\ntype P = Pick<L, K> & { a: number };',
    ],
    [
      "`Required` over a member that holds `undefined`, against one that does not",
      "interface L { a: string | undefined }\ntype P = Required<L> & { a: string };",
    ],
    [
      "two bases that type a member differently",
      "interface A { a: string }\ninterface B { a: number }\ninterface P extends A, B {}",
    ],
  ])("reports %s (UF6005)", async (_, types) => {
    const source = `${types}\nexport function C(props: P) { return <p />; }`;
    const { module, diagnostics } = await analyzeWith({ "A.uf.tsx": source });
    expect(problems(source, diagnostics)).toEqual(["UF6005 P"]);
    expect(diagnostics[0]!.message).toContain(
      "`a` is declared with different types or optionality",
    );
    expect(module?.components ?? []).toEqual([]);
  });

  it.each([
    [
      "`Required` keeping a written `undefined`",
      "interface L { a: string | undefined }\ntype P = Required<L> & { a: string | undefined };",
    ],
    [
      "an override of a member `Omit` leaves out",
      'interface L { a: string; b: number }\ninterface P extends Omit<L, "a"> { a: number }',
    ],
    [
      "an override of a member `Pick` leaves out",
      'interface L { a: string; b: number }\ninterface P extends Pick<L, "b"> { a: number }',
    ],
    // One member written once is declared once, however a utility maps it (the owner's call).
    ["`Partial<L> & L`", "interface L { a: string }\ntype P = Partial<L> & L;"],
    ["`L & Partial<L>`", "interface L { a: string }\ntype P = L & Partial<L>;"],
    ["`Required<L> & L`", "interface L { a?: string }\ntype P = Required<L> & L;"],
  ])("accepts %s", async (_, types) => {
    const source = `${types}\nexport function C(props: P) { return <p />; }`;
    const { module, diagnostics } = await analyzeWith({ "A.uf.tsx": source });
    expect(diagnostics).toEqual([]);
    expect(only(module).name).toBe("C");
  });
});
