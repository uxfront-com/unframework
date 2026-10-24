import { readFile } from "node:fs/promises";

import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";

import { typeOracleContract } from "../src/contract.ts";
import { createSyntacticOracle, localShapes, printShape } from "../src/index.ts";
import type { ObjectNode, TypeOracle, TypeShape } from "../src/index.ts";

typeOracleContract("syntactic", ({ root }) =>
  createSyntacticOracle({
    root,
    readFile: (path) => readFile(path, "utf8").catch(() => undefined),
  }),
);

/** An oracle over files in memory, under `/project`, that records what it reads. */
function memory(files: Record<string, string>): { oracle: TypeOracle; reads: string[] } {
  const reads: string[] = [];
  const oracle = createSyntacticOracle({
    root: "/project/",
    readFile: (path) => {
      reads.push(path);
      return Promise.resolve(files[path.slice("/project/".length)]);
    },
  });
  return { oracle, reads };
}

/** The query for the first `type` written after `after` in `source`. */
function at(file: string, source: string, after: string, type: string) {
  const start = source.indexOf(type, source.indexOf(after) + after.length);
  return { file, span: { start, end: start + type.length } };
}

const root = (shape: TypeShape) => shape.nodes[shape.root] as ObjectNode;

describe("createSyntacticOracle", () => {
  it("records each member's file, declaration, span, text and references", async () => {
    const types = [
      "export type Size = 'sm' | 'md';",
      "interface Inner { size: Size; tags: Array<Size> }",
      "export type { Inner };",
    ].join("\n");
    const button = 'import type { Inner } from "./types.ts";\nfunction B(props: Inner) {}';
    const { oracle } = memory({ "types.ts": types, "Button.uf.tsx": button });
    const shape = await oracle.resolveShape(at("Button.uf.tsx", button, "props: ", "Inner"));
    const [size, tags] = root(shape).members;
    expect(root(shape).declaration).toEqual({ file: "types.ts", name: "Inner", exported: true });
    expect(size).toEqual({
      name: "size",
      optional: false,
      readonly: false,
      type: size!.type,
      file: "types.ts",
      declaration: { file: "types.ts", name: "Inner", exported: true },
      span: { start: types.indexOf("size: Size"), end: types.indexOf("size: Size") + 11 },
      typeText: {
        code: "Size",
        span: { start: types.indexOf("size: Size") + 6, end: types.indexOf("size: Size") + 10 },
      },
      references: ["Size"],
    });
    expect(tags!.references).toEqual(["Array", "Size"]);
    expect(printShape(shape)).toBe('{ size: "sm" | "md"; tags: ("sm" | "md")[] }');
  });

  it("keeps a recursive type as a cycle of node ids", async () => {
    const source = "interface Tree { children: Tree[] }\nfunction T(props: Tree) {}";
    const { oracle } = memory({ "T.uf.tsx": source });
    const shape = await oracle.resolveShape(at("T.uf.tsx", source, "props: ", "Tree"));
    const children = shape.nodes[root(shape).members[0]!.type]!;
    expect(children).toEqual({ kind: "array", element: shape.root, readonly: false });
    expect(JSON.parse(JSON.stringify(shape))).toEqual(shape);
  });

  it("resolves an extensionless relative specifier", async () => {
    const source = 'import type { P } from "./types";\nfunction C(props: P) {}';
    const { oracle, reads } = memory({
      "types.ts": "export type P = { a: string };",
      "C.uf.tsx": source,
    });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "P"));
    expect(printShape(shape)).toBe("{ a: string }");
    expect(shape.dependencies).toEqual(["types.ts"]);
    expect(reads).toEqual(["/project/C.uf.tsx", "/project/types.ts"]);
  });

  it.each([
    ["Partial<P>", "utility:Partial"],
    ["Wrap<string>", "generic"],
    ["P extends string ? A : B", "conditional"],
    ["{ [K in Keys]: string }", "mapped"],
    ["P['a']", "indexed-access"],
    ["keyof P", "keyof"],
    ["typeof value", "typeof"],
    ["`on${string}`", "template-literal"],
    ["{ [key: string]: number }", "index-signature"],
    ["{ [key]: number }", "computed-key"],
    ["{ a: string } & string", "intersection"],
    ["NS.P", "qualified-name"],
  ])("leaves %s unresolved, as %s", async (type, construct) => {
    const source = `type P = { a: string };\ntype Wrap<T> = T;\nconst key = "a";\nfunction C(props: ${type}) {}`;
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", type));
    expect(shape.construction).toContain(construct);
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["unsupported"]);
    expect(printShape(shape)).not.toContain("never");
  });

  it("names a package it does not read yet as a dependency, unresolved", async () => {
    const source = 'import type { Item } from "@scope/ui/types";\nfunction C(props: Item) {}';
    const { oracle, reads } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "Item"));
    expect(shape.dependencies).toEqual(["pkg:@scope/ui"]);
    expect(shape.construction).toEqual(["package"]);
    expect(shape.unresolved).toEqual([
      {
        file: "C.uf.tsx",
        span: at("C.uf.tsx", source, "props: ", "Item").span,
        reason: "unsupported",
      },
    ]);
    expect(reads).toEqual(["/project/C.uf.tsx"]);
  });

  it("keeps a global of TypeScript's lib as written, and resolved", async () => {
    const source = "function C(props: { at: Date; title?(): Element }) {}";
    const { oracle } = memory({ "C.uf.tsx": source });
    const type = "{ at: Date; title?(): Element }";
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", type));
    expect(printShape(shape)).toBe("{ at: Date; title?: () => Element }");
    expect(shape.unresolved).toEqual([]);
  });

  it("reports a member two parts of an intersection declare differently", async () => {
    const source =
      "type A = { a: string };\ntype B = { a: number; b: string };\nfunction C(props: A & B) {}";
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "A & B"));
    expect(printShape(shape)).toBe("{ a: string; b: string }");
    const a = root(shape).members[0]!;
    expect(shape.nodes[a.type]).toEqual({
      kind: "opaque",
      text: "string",
      file: "C.uf.tsx",
      span: a.typeText!.span,
    });
    // The entry is at the opaque node's span, so the canonical print shows it unresolved.
    expect(shape.unresolved).toEqual([
      { file: "C.uf.tsx", span: a.typeText!.span, reason: "conflict" },
    ]);
    expect(printShape(shape, { canonical: true })).toBe("{ a: (unresolved); b: string }");
  });

  it("reads each file once, and again after update names it", async () => {
    const files = {
      "types.ts": "export type P = { a: string };",
      "C.uf.tsx": 'import type { P } from "./types.ts";\nfunction C(props: P) {}',
    };
    const { oracle, reads } = memory(files);
    const query = at("C.uf.tsx", files["C.uf.tsx"], "props: ", "P");
    await oracle.resolveShape(query);
    await oracle.resolveShape(query);
    expect(reads).toEqual(["/project/C.uf.tsx", "/project/types.ts"]);
    files["types.ts"] = "export type P = { a: string; b: number };";
    await oracle.update({ files: ["types.ts"] });
    expect(printShape(await oracle.resolveShape(query))).toBe("{ a: string; b: number }");
    expect(reads).toEqual(["/project/C.uf.tsx", "/project/types.ts", "/project/types.ts"]);
  });

  it("rejects a query for a file it cannot read, or a span with no type", async () => {
    const { oracle } = memory({ "C.uf.tsx": "function C(props: { a: string }) {}" });
    await expect(
      oracle.resolveShape({ file: "D.uf.tsx", span: { start: 0, end: 1 } }),
    ).rejects.toThrow("Cannot read D.uf.tsx.");
    await expect(
      oracle.resolveShape({ file: "C.uf.tsx", span: { start: 0, end: 8 } }),
    ).rejects.toThrow("No type at C.uf.tsx:0-8.");
  });

  it("flattens a union of unions, with no node twice", async () => {
    const source = 'type AB = "a" | "b";\nfunction C(props: AB | "b" | "c") {}';
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", 'AB | "b" | "c"'));
    const union = shape.nodes[shape.root]!;
    expect(union.kind).toBe("union");
    const types = union.kind === "union" ? union.types : [];
    expect(types.map((id) => shape.nodes[id])).toEqual([
      { kind: "literal", value: "a" },
      { kind: "literal", value: "b" },
      { kind: "literal", value: "c" },
    ]);
  });

  it("keeps an overloaded method's name, with its type unresolved", async () => {
    const source =
      "interface A { f(a: string | number): void }\ninterface P extends A { f(a: string): void; f(a: number): void; g(): void }\nfunction C(props: P) {}";
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "P"));
    const [f, g] = root(shape).members;
    expect(shape.nodes[f!.type]).toEqual({
      kind: "opaque",
      text: "f(a: string): void;",
      file: "C.uf.tsx",
      span: { start: source.indexOf("f(a: string)"), end: source.indexOf("f(a: string)") + 19 },
    });
    expect(f!.declaration?.name).toBe("P");
    expect(printShape({ ...shape, root: g!.type })).toBe("() => void");
    expect(shape.construction).toEqual(["overload", "extends", "union"]);
    const first = {
      start: source.indexOf("f(a: string)"),
      end: source.indexOf("f(a: string)") + 19,
    };
    expect(shape.unresolved).toEqual([{ file: "C.uf.tsx", span: first, reason: "unsupported" }]);
  });

  it.each([
    ["a property and a property of another type", "a: number"],
    ["a property and a method", "a(): void"],
    ["a method and a property of the same type", "a(): string", "a: () => string"],
    ["a property and a method of the same type", "a: () => string", "a(): string"],
  ])(
    "reports %s that merged interfaces declare as one name",
    async (_, second, first = "a: string") => {
      const source = `interface P { ${first} }\ninterface P { ${second} }\nfunction C(props: P) {}`;
      const { oracle } = memory({ "C.uf.tsx": source });
      const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "P"));
      expect(shape.nodes[root(shape).members[0]!.type]!.kind).toBe("opaque");
      expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["conflict"]);
    },
  );

  it("keeps a member two parts declare with the same type, however it is written", async () => {
    const type = "{ a: { x: 1 }; b: string | number } & { a: { x: 1 }; b: number | string }";
    const source = `function C(props: ${type}) {}`;
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", type));
    expect(printShape(shape)).toBe("{ a: { x: 1 }; b: string | number }");
    expect(shape.unresolved).toEqual([]);
  });

  it.each([
    ["a generic method", "f<T extends string>(a: T): void", "f(a: string): void", "generic"],
    ["an accessor", 'get f(): "x"', "f: string", "accessor"],
  ])(
    "keeps %s's name over its base's, with its type unresolved",
    async (_, own, base, construct) => {
      const source = `interface A { ${base} }\ninterface B extends A { ${own} }\nfunction C(props: B) {}`;
      const { oracle } = memory({ "C.uf.tsx": source });
      const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "B"));
      const [f] = root(shape).members;
      expect(root(shape).members).toHaveLength(1);
      expect(shape.nodes[f!.type]).toMatchObject({ kind: "opaque", text: own });
      expect(f!.declaration?.name).toBe("B");
      expect(shape.construction).toContain(construct);
      expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["unsupported"]);
    },
  );

  it("keeps a member that merged interfaces declare with one object type twice", async () => {
    const source =
      "interface P { a: { x: 1 } }\ninterface P { a: { x: 1 } }\nfunction C(props: P) {}";
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "P"));
    expect(printShape(shape)).toBe("{ a: { x: 1 } }");
    expect(shape.unresolved).toEqual([]);
  });

  it("does not take two declarations of one name in two files for one type", async () => {
    const files = {
      "a.ts": 'import type { N as B } from "./b.ts";\nexport interface N { x: B }',
      "b.ts": 'import type { N as A } from "./a.ts";\nexport interface N { y: A }',
      "c.ts": "export interface X { x: N }\ninterface N { y: N }",
      "q.ts":
        'import type { N } from "./a.ts";\nimport type { X } from "./c.ts";\nfunction C(props: { v: N } & { v: X }) {}',
    };
    const { oracle } = memory(files);
    const shape = await oracle.resolveShape(
      at("q.ts", files["q.ts"], "props: ", "{ v: N } & { v: X }"),
    );
    expect(printShape(shape, { canonical: true })).toBe("{ v: (unresolved) }");
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["conflict"]);
  });

  it.each([
    ["a nested conflict", '{ v: { a: string } } & { v: { a: string } & { a: "x" } }'],
    ["two different unresolved types", "{ a: { k: Foo } } & { a: { k: Bar } }"],
  ])("reports %s at the member that holds it", async (_, type) => {
    const source = `function C(props: ${type}) {}`;
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", type));
    expect(printShape(shape, { canonical: true })).toMatch(/^\{ (v|a): \(unresolved\) \}$/);
    expect(shape.unresolved.map((entry) => entry.reason)).toContain("conflict");
  });

  it("compares two deep declared types by their declarations, without walking them", async () => {
    // At depth 40, a walk over both chains takes 2^40 steps, so it would time out.
    const chain = (name: string) =>
      [`interface ${name}0 { x: 1 }`]
        .concat(
          Array.from(
            { length: 40 },
            (_, i) => `interface ${name}${i + 1} { a: ${name}${i}; b: ${name}${i} }`,
          ),
        )
        .join("\n");
    const type = "{ v: T40 } & { v: U40 }";
    const source = `${chain("T")}\n${chain("U")}\nfunction C(props: ${type}) {}`;
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", type));
    expect(printShape(shape, { canonical: true })).toBe("{ v: (unresolved) }");
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["conflict"]);
  });

  it("drops what was unresolved in a base member the interface overrides", async () => {
    const source =
      'interface X { k: 1 }\ninterface B { a: keyof X }\ninterface P extends B { a: "x" }\nfunction C(props: P) {}';
    const { oracle } = memory({ "C.uf.tsx": source });
    const query = at("C.uf.tsx", source, "props: ", "P");
    expect((await oracle.resolveShape(query)).unresolved).toEqual([]);
    expect(await oracle.printType(query)).toBe('{ a: "x" }');
  });

  it.each([
    ["after a plain signature", 'on(e: "click"): void; on<T>(e: T): void'],
    ["before a plain signature", 'on<T>(e: T): void; on(e: "click"): void'],
  ])("leaves an overload set with a generic signature %s opaque", async (_, signatures) => {
    const source = `interface P { ${signatures} }\nfunction C(props: P) {}`;
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "P"));
    expect(printShape(shape, { canonical: true })).toBe("{ on: (unresolved) }");
  });

  it("keeps a base's members opaque beside a computed key of unknown name", async () => {
    const source =
      'const k = "a";\ninterface B { a: string; b: number }\ninterface P extends B { [k]: "x"; c: boolean }\nfunction C(props: P) {}';
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "P"));
    expect(printShape(shape, { canonical: true })).toBe(
      "{ a: (unresolved); b: (unresolved); c: boolean }",
    );
    expect(shape.construction).toContain("computed-key");
  });

  it.each([
    ["an exported enum", "export enum E { A }", "import type { E as T } from './e.ts';"],
    [
      "a default-exported class",
      "export default class K { a = 1 }",
      "import type T from './e.ts';",
    ],
  ])("leaves %s, imported as a type, unresolved", async (_, declaration, importLine) => {
    const source = `${importLine}\nfunction C(props: T) {}`;
    const { oracle } = memory({ "e.ts": declaration, "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "T"));
    expect(shape.construction).toContain("class-or-enum");
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["unsupported"]);
  });

  it.each([
    [
      "a base it cannot read",
      'import type { B } from "./missing.ts";\ninterface P extends B { a: string }',
      "P",
      "missing-module",
      "{ a: string }",
    ],
    [
      "a part it cannot read",
      'import type { B } from "./missing.ts";\ntype P = B & { a: string };',
      "P",
      "missing-module",
      "{ a: string }",
    ],
    [
      "a part's computed key of unknown name",
      'const k = "a";\ntype P = { [k]: 1 } & { a: string };',
      "P",
      "unsupported",
      "{ a: (unresolved) }",
    ],
  ])(
    "keeps what was unresolved in %s, beside the members it has",
    async (_, declarations, type, reason, printed) => {
      const source = `${declarations}\nfunction C(props: ${type}) {}`;
      const { oracle } = memory({ "C.uf.tsx": source });
      const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", type));
      expect(shape.unresolved.map((entry) => entry.reason)).toContain(reason);
      expect(printShape(shape, { canonical: true })).toBe(printed);
    },
  );

  it.each([
    [
      "a union with a member the other lacks",
      '{ v: { a: "x" | "y" } } & { v: { a: "x" | "y" | "z" } }',
    ],
    ["an object with a computed key of unknown name", "{ v: { [k]: 1 } } & { v: { [k]: 1 } }"],
    [
      "an intersection with a computed key of unknown name",
      "{ v: { [k]: 1 } & { b: 1 } } & { v: { [k]: 1 } & { b: 1 } }",
    ],
    [
      "a pair that failed once inside a union",
      "{ v: { u: L | M; w: L } } & { v: { u: M | K; w: M } }",
    ],
  ])("is not sure two types are the same with %s", async (_, type) => {
    const source = `const k = "a";\ntype L = { a: 1 }[];\ntype M = { a: 2 }[];\ntype K = { a: 1 }[];\nfunction C(props: ${type}) {}`;
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", type));
    expect(shape.unresolved.map((entry) => entry.reason)).toContain("conflict");
  });

  it("reports a member three parts declare differently once", async () => {
    const type = "{ a: string } & { a: number } & { a: boolean }";
    const source = `function C(props: ${type}) {}`;
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", type));
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["conflict"]);
  });

  it.each([
    ["an index signature in a part", "type P = { [key: string]: number } & { a: number };", "P"],
    [
      "an index signature in a base",
      "interface B { [k: string]: unknown; a: 1 }\ninterface P extends B { b: 1 }",
      "P",
    ],
    [
      "a call signature in a base",
      "interface B { (): void; a: 1 }\ninterface P extends B { b: 1 }",
      "P",
    ],
    [
      "a computed key of unknown name in a base",
      'const k = "z";\ninterface B { [k]: 1 }\ninterface P extends B { b: 1 }',
      "P",
    ],
    [
      "a generic base of a base",
      "interface G<T> { g: T }\ninterface B extends G<string> { a: 1 }\ninterface P extends B { b: 1 }",
      "P",
    ],
    [
      "an unresolved part of a base",
      "interface Q { a: 1 }\ntype B = Partial<Q> & { b: 1 };\ninterface P extends B { c: 1 }",
      "P",
    ],
    [
      "a qualified base of a base",
      "interface B extends NS.A { a: 1 }\ninterface P extends B { b: 1 }",
      "P",
    ],
    [
      "a base of a base that is not an object",
      "type S = string;\ninterface B extends S { a: 1 }\ninterface P extends B { b: 1 }",
      "P",
    ],
    [
      "a circular chain of three",
      "interface A extends C { a: 1 }\ninterface B extends A { b: 1 }\ninterface C extends B { c: 1 }",
      "A",
    ],
  ])("keeps what was lost to %s, so printType rejects", async (_, declarations, type) => {
    const source = `${declarations}\nfunction C(props: ${type}) {}`;
    const { oracle } = memory({ "C.uf.tsx": source });
    const query = at("C.uf.tsx", source, "props: ", type);
    expect((await oracle.resolveShape(query)).unresolved).not.toEqual([]);
    await expect(oracle.printType(query)).rejects.toThrow("it has unresolved parts.");
  });

  it.each([
    ["an index signature", "{ [k: string]: number; a: 1 }"],
    ["a call signature", "{ (): void; a: 1 }"],
    ["an unresolved part", "{ a: 1 } & Partial<Q>"],
    ["a construct two levels down", "{ w: { [k: string]: number }; a: 1 }"],
  ])("is not sure of an object that lost %s, in either part", async (_, lossy) => {
    for (const type of [`{ v: { a: 1 } } & { v: ${lossy} }`, `{ v: ${lossy} } & { v: { a: 1 } }`]) {
      const source = `interface Q { q: 1 }\nfunction C(props: ${type}) {}`;
      const { oracle } = memory({ "C.uf.tsx": source });
      const query = at("C.uf.tsx", source, "props: ", type);
      expect((await oracle.resolveShape(query)).unresolved).not.toEqual([]);
      await expect(oracle.printType(query)).rejects.toThrow("it has unresolved parts.");
    }
  });

  it("keeps an entry a failed base carries while its opaque node is reachable by another path", async () => {
    const source = [
      "interface X { x: 1 }",
      "type S = Partial<X>;",
      "interface B extends S { a: 1 }",
      "interface Q { m: B }",
      "interface D extends Q { m: never }",
      "interface P { d: D; g: S }",
      "function C(props: P) {}",
    ].join("\n");
    const { oracle } = memory({ "C.uf.tsx": source });
    const query = at("C.uf.tsx", source, "props: ", "P");
    expect((await oracle.resolveShape(query)).unresolved.map((entry) => entry.reason)).toEqual([
      "unsupported",
    ]);
    await expect(oracle.printType(query)).rejects.toThrow("it has unresolved parts.");
  });

  it("keeps an entry while the opaque node it describes is reachable by another path", async () => {
    const source = [
      "interface X { x: 1 }",
      "type Foo = { a: keyof X } | string;",
      "interface B { m: Foo & { z: 1 } }",
      "interface D extends B { m: never }",
      "interface P { f: D; g: Foo }",
      "function C(props: P) {}",
    ].join("\n");
    const { oracle } = memory({ "C.uf.tsx": source });
    const query = at("C.uf.tsx", source, "props: ", "P");
    const shape = await oracle.resolveShape(query);
    expect(shape.unresolved).toEqual([
      {
        file: "C.uf.tsx",
        span: at("C.uf.tsx", source, "a: ", "keyof X").span,
        reason: "unsupported",
      },
    ]);
    await expect(oracle.printType(query)).rejects.toThrow("it has unresolved parts.");
  });

  it.each([
    [
      "after the member that holds it",
      "interface P { v: { k: 1 } & P; w: string }\ninterface P { v: { k: 1 } & P }",
    ],
    [
      "before the member that holds it",
      "interface P { w: string; v: { k: 1 } & P }\ninterface P { v: { k: 1 } & P }",
    ],
  ])(
    "is not sure of a merged interface's member whose intersection is not merged yet, %s",
    async (_, declarations) => {
      const source = `${declarations}\nfunction C(props: P) {}`;
      const { oracle } = memory({ "C.uf.tsx": source });
      const query = at("C.uf.tsx", source, "props: ", "P");
      const shape = await oracle.resolveShape(query);
      expect(printShape(shape, { canonical: true })).toBe("{ v: (unresolved); w: string }");
      expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["conflict"]);
    },
  );

  it.each([
    ["first", "interface P { v: {} & {} }\ninterface P { v: {} }"],
    ["second", "interface P { v: {} }\ninterface P { v: {} & {} }"],
  ])("is not sure of an intersection not merged yet, written %s", async (_, declarations) => {
    const source = `${declarations}\nfunction C(props: P) {}`;
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "P"));
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["conflict"]);
  });

  describe("compares deep shared types once per pair", () => {
    // Without a cache of the pairs compared, each of these takes seconds: 2^depth steps.
    const chain = (name: string, depth: number, leaf: string, form: (inner: string) => string) =>
      [`type ${name}0 = ${leaf};`]
        .concat(
          Array.from({ length: depth }, (_, i) => `type ${name}${i + 1} = ${form(name + i)};`),
        )
        .join("\n");
    const objects = (inner: string) => `{ a: ${inner} }[] | { a: ${inner} }[]`;
    const pairs = (inner: string) => `[{ a: ${inner} }, 1] | [{ a: ${inner} }, 2]`;
    const reversed = (inner: string) => `[{ a: ${inner} }, 2] | [{ a: ${inner} }, 1]`;
    it.each([
      ["arrays of objects, different at the leaves", 22, "2", objects, objects, ["conflict"]],
      ["arrays of objects, equal", 12, "1", objects, objects, []],
      ["tuples in another order", 12, "1", pairs, reversed, []],
    ])("%s", async (_, depth, leaf, left, right, reasons) => {
      const type = `{ v: T${depth} } & { v: U${depth} }`;
      const source = [
        chain("T", depth, "1", left),
        chain("U", depth, leaf, right),
        `function C(props: ${type}) {}`,
      ].join("\n");
      const { oracle } = memory({ "C.uf.tsx": source });
      const query = at("C.uf.tsx", source, "props: ", type);
      const start = performance.now();
      const shape = await oracle.resolveShape(query);
      expect(performance.now() - start).toBeLessThan(500);
      expect(shape.unresolved.map((entry) => entry.reason)).toEqual(reasons);
    });

    it("matches a wide union's members without comparing every pair", async () => {
      const objects = Array.from({ length: 2900 }, (_, i) => `{ k: ${i} }`);
      const type = `{ v: ${objects.join(" | ")} } & { v: ${objects.toReversed().join(" | ")} }`;
      const source = `function C(props: ${type}) {}`;
      const { oracle } = memory({ "C.uf.tsx": source });
      const start = performance.now();
      const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", type));
      expect(performance.now() - start).toBeLessThan(1000);
      expect(shape.unresolved).toEqual([]);
    });

    it("is not sure past its bound of pairs, and does not throw", async () => {
      // Members alike three levels down share one fingerprint, so each pair is compared.
      const objects = Array.from({ length: 800 }, (_, i) => `{ a: { b: { c: { d: ${i} } } } }`);
      const type = `{ v: ${objects.join(" | ")} } & { v: ${objects.toReversed().join(" | ")} }`;
      const source = `function C(props: ${type}) {}`;
      const { oracle } = memory({ "C.uf.tsx": source });
      const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", type));
      expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["conflict"]);
    });
  });

  it("is not sure of two recursive types with no name, and stops", async () => {
    const source = [
      "interface R1 { b?: R1 & { x: 1 } }",
      "interface R2 { b?: R2 & { x: 1 } }",
      "function C(props: { v: R1 & { x: 1 } } & { v: R2 & { x: 1 } }) {}",
    ].join("\n");
    const { oracle } = memory({ "C.uf.tsx": source });
    const type = "{ v: R1 & { x: 1 } } & { v: R2 & { x: 1 } }";
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", type));
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["conflict"]);
  });

  it.each([
    ["one more member", "{ a: 1 }", "{ a: 1; b: 1 }"],
    ["an optional member", "{ a?: 1 }", "{ a: 1 }"],
    ["a readonly member", "{ readonly a: 1 }", "{ a: 1 }"],
    ["a member of another name", "{ a: 1 }", "{ b: 1 }"],
    ["a readonly array", "{ a: { x: 1 }[] }", "{ a: readonly { x: 1 }[] }"],
    ["a readonly tuple", "{ a: [{ x: 1 }] }", "{ a: readonly [{ x: 1 }] }"],
    ["one more element", "{ a: [{ x: 1 }] }", "{ a: [{ x: 1 }, { x: 1 }] }"],
    ["an optional element", "{ a: [{ x: 1 }?] }", "{ a: [{ x: 1 }] }"],
    ["a rest element", "{ a: [...{ x: 1 }[]] }", "{ a: [{ x: 1 }[]] }"],
    ["one more parameter", "{ a: (p: { x: 1 }) => void }", "{ a: (p: { x: 1 }, q: 1) => void }"],
    ["an optional parameter", "{ a: (p?: { x: 1 }) => void }", "{ a: (p: { x: 1 }) => void }"],
    ["a rest parameter", "{ a: (...p: { x: 1 }[]) => void }", "{ a: (p: { x: 1 }[]) => void }"],
    ["another return type", "{ a: () => { x: 1 } }", "{ a: () => { x: 2 } }"],
    ["a `this` parameter", "{ a: (this: { x: 1 }) => void }", "{ a: () => void }"],
    ["a union with another member", '{ a: { x: 1 } | "y" }', '{ a: { x: 1 } | "z" }'],
  ])("reports a member whose types differ by %s", async (_, left, right) => {
    const type = `{ v: ${left} } & { v: ${right} }`;
    const source = `function C(props: ${type}) {}`;
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", type));
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["conflict"]);
  });

  it.each([
    ["objects", "{ a: { x: 1 } }"],
    ["arrays and readonly arrays", "{ a: { x: 1 }[]; b: readonly { x: 1 }[] }"],
    ["tuples", "{ a: [{ x: 1 }, ...{ y: 1 }[]]; b: readonly [{ x: 1 }?] }"],
    ["functions", "{ a: (p: { x: 1 }, q?: 1, ...r: { y: 1 }[]) => { z: 1 } }"],
    ["unions in another order", '{ a: { x: 1 } | "y" | { z: 1 } }'],
    ["unions inside a union, one with a repeated member", '{ a: { u: { x: 1 } | "y" } | "z" }'],
  ])("keeps a member two parts write with the same %s", async (_, written) => {
    const reordered = written
      .replace('{ x: 1 } | "y" | { z: 1 }', '{ z: 1 } | { x: 1 } | "y"')
      .replace('{ u: { x: 1 } | "y" }', '{ u: "y" | { x: 1 } | { x: 1 } }');
    const type = `{ v: ${written} } & { v: ${reordered} }`;
    const source = `function C(props: ${type}) {}`;
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", type));
    expect(shape.unresolved).toEqual([]);
  });

  it.each([
    ["a union", "{ a: keyof X | 1 }"],
    ["an array", "{ a: (keyof X)[] }"],
    ["a tuple", "{ a: [keyof X] }"],
    ["a parameter", "{ a: (p: keyof X) => void }"],
    ["a return type", "{ a: () => keyof X }"],
    ["a type parameter's constraint", "{ a: T }"],
  ])("keeps what is unresolved in %s", async (_, type) => {
    const source = `interface X { x: 1 }\nfunction C<T extends keyof X>(props: ${type}) {}`;
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", type));
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["unsupported"]);
  });

  it("checks a later member of a name again after the same type was written twice", async () => {
    const source = "interface P { a: 1; a: 1; a: string }\nfunction C(props: P) {}";
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "P"));
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["conflict"]);
  });

  it("keeps an accessor opaque over a later property of its name, reported once", async () => {
    const source = 'interface P { get a(): "x"; a: string }\nfunction C(props: P) {}';
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "P"));
    expect(printShape(shape, { canonical: true })).toBe("{ a: (unresolved) }");
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["unsupported"]);
  });

  it("reads a computed key that is a literal as the member's name", async () => {
    const source =
      'interface A { a: string }\ninterface B extends A { ["a"]: "x" }\nfunction C(props: B) {}';
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "B"));
    expect(printShape(shape)).toBe('{ a: "x" }');
    expect(shape.unresolved).toEqual([]);
  });

  it("reports a method overloaded three times once", async () => {
    const source =
      "interface P { f(a: string): void; f(a: number): void; f(a: boolean): void }\nfunction C(props: P) {}";
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "P"));
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["unsupported"]);
  });

  it("leaves an interface generic in a later declaration unresolved", async () => {
    const source = "interface G { a: string }\ninterface G<T> { b: T }\nfunction C(props: G) {}";
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "G"));
    expect(shape.construction).toEqual(["generic"]);
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["unsupported"]);
  });

  it("resolves a cycle through aliases of intersections from any of them", async () => {
    const source =
      "type A = B & { a: 1 };\ntype B = C & { b: 1 };\ntype C = { c: A };\nfunction C1(props: A, other: C) {}";
    const { oracle } = memory({ "C.uf.tsx": source });
    const a = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "A"));
    const c = await oracle.resolveShape(at("C.uf.tsx", source, "other: ", "C"));
    expect(printShape(a, { canonical: true })).toBe("{ a: 1; b: 1; c: A }");
    expect(printShape(c, { canonical: true })).toBe("{ c: { a: 1; b: 1; c: A } }");
    expect([...a.unresolved, ...c.unresolved]).toEqual([]);
  });

  it("leaves a class or an enum used as a type unresolved", async () => {
    const source =
      "class P { a = 1 }\ninterface P { b: string }\nexport enum E { A }\nfunction C(props: P, other: E) {}";
    const { oracle } = memory({ "C.uf.tsx": source });
    for (const [after, type] of [
      ["props: ", "P"],
      ["other: ", "E"],
    ] as const) {
      const shape = await oracle.resolveShape(at("C.uf.tsx", source, after, type));
      expect(shape.construction).toEqual(["class-or-enum"]);
      expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["unsupported"]);
    }
  });

  it("reads a named rest element of a tuple", async () => {
    const source = "function C(props: { e: [first: string, ...rest: number[]] }) {}";
    const { oracle } = memory({ "C.uf.tsx": source });
    const type = "{ e: [first: string, ...rest: number[]] }";
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", type));
    expect(printShape(shape)).toBe(type);
    expect(shape.unresolved).toEqual([]);
  });

  it("leaves an interface that extends itself, and a repeated alias, unresolved", async () => {
    const source = [
      "interface A extends B { a: string }",
      "interface B extends A { b: string }",
      "type D = { d: string };",
      "type D = { e: string };",
      "function C(props: A, other: D) {}",
    ].join("\n");
    const { oracle } = memory({ "C.uf.tsx": source });
    const cycle = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "A"));
    expect(cycle.construction).toContain("circular");
    expect(cycle.unresolved.map((entry) => entry.reason)).toEqual(["unsupported"]);
    const repeated = await oracle.resolveShape(at("C.uf.tsx", source, "other: ", "D"));
    expect(repeated.construction).toEqual(["duplicate-declaration"]);
    expect(printShape(repeated)).toBe("D");
  });

  it("names the declaration's module, and whether it exports it, on each member", async () => {
    const types =
      "export interface Base { a: string }\ninterface Own extends Base { b: string }\nexport type { Own as Public };";
    const button = 'import type { Public } from "./types.ts";\nfunction B(props: Public) {}';
    const { oracle } = memory({ "types.ts": types, "B.uf.tsx": button });
    const shape = await oracle.resolveShape(at("B.uf.tsx", button, "props: ", "Public"));
    expect(root(shape).members.map((member) => member.declaration)).toEqual([
      { file: "types.ts", name: "Own", exported: true },
      { file: "types.ts", name: "Base", exported: true },
    ]);
    const local = "interface Own { b: string }\nfunction B(props: Own) {}";
    const { oracle: other } = memory({ "B.uf.tsx": local });
    const own = await other.resolveShape(at("B.uf.tsx", local, "props: ", "Own"));
    expect(root(own).declaration).toEqual({ file: "B.uf.tsx", name: "Own", exported: false });
  });

  it("reads every file again after dispose", async () => {
    const source = "function C(props: { a: string }) {}";
    const { oracle, reads } = memory({ "C.uf.tsx": source });
    const query = at("C.uf.tsx", source, "props: ", "{ a: string }");
    await oracle.resolveShape(query);
    await oracle.dispose();
    await oracle.resolveShape(query);
    expect(reads).toEqual(["/project/C.uf.tsx", "/project/C.uf.tsx"]);
  });

  it.each([".", ".."])("reads %s as a relative specifier, not a package", async (specifier) => {
    const source = `import type { P } from "${specifier}";\nfunction C(props: P) {}`;
    const { oracle } = memory({ "src/C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("src/C.uf.tsx", source, "props: ", "P"));
    expect(shape.dependencies).toEqual([]);
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["missing-module"]);
  });

  it.each(["1e400", "-1e400"])("leaves %s, which JSON cannot hold, unresolved", async (literal) => {
    const source = `function C(props: { a: ${literal} }) {}`;
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", `{ a: ${literal} }`));
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["unsupported"]);
    expect(JSON.parse(JSON.stringify(shape))).toEqual(shape);
  });
});

describe("printShape", () => {
  it("parenthesises what binds looser than `[]` and `?`", async () => {
    const type = "{ a: (readonly string[])[]; b: [(string | number)?]; c: (readonly [string])[] }";
    const source = `function C(props: ${type}) {}`;
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", type));
    expect(printShape(shape)).toBe(type);
  });

  it("refuses a recursive object with no name, which printType rejects", async () => {
    const source = "interface A { b?: A & { x: 1 } }\nfunction C(props: A) {}";
    const { oracle } = memory({ "C.uf.tsx": source });
    const query = at("C.uf.tsx", source, "props: ", "A");
    const shape = await oracle.resolveShape(query);
    expect(() => printShape(shape)).toThrow("Cannot print a recursive type that has no name.");
    expect(printShape(shape, { canonical: true })).toBe("{ b?: { b?: (cycle ^1); x: 1 } }");
    await expect(oracle.printType(query)).rejects.toThrow("Cannot print a recursive type");
  });

  it("is rejected by printType for a type with unresolved parts", async () => {
    const source = "function C(props: { a: Partial<{ b: string }> }) {}";
    const { oracle } = memory({ "C.uf.tsx": source });
    const query = at("C.uf.tsx", source, "props: ", "{ a: Partial<{ b: string }> }");
    await expect(oracle.printType(query)).rejects.toThrow("it has unresolved parts.");
  });
});

describe("localShapes", () => {
  const source = [
    'import type { Size } from "./types.ts";',
    "interface Props { label: string; size?: Size }",
    "function C(props: Props) {}",
  ].join("\n");
  const { program } = parseSync("C.uf.tsx", source, { astType: "ts" });
  const shapes = localShapes({ program, source }, "C.uf.tsx");

  it("resolves the module's own declarations, and leaves an import external", () => {
    const shape = shapes(at("C.uf.tsx", source, "props: ", "Props").span)!;
    expect(printShape(shape)).toBe("{ label: string; size?: Size }");
    expect(shape.unresolved).toEqual([
      {
        file: "C.uf.tsx",
        span: at("C.uf.tsx", source, "size?: ", "Size").span,
        reason: "external",
      },
    ]);
    expect(shape.dependencies).toEqual([]);
  });

  it("gives the same shape for the same span, and nothing for a span with no type", () => {
    const span = at("C.uf.tsx", source, "props: ", "Props").span;
    expect(shapes(span)).toBe(shapes(span));
    expect(shapes({ start: 0, end: 6 })).toBeUndefined();
  });
});
