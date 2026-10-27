import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { printShape } from "@unframework/type-oracle";
import type { ShapeQuery, TypeOracle, TypeShape } from "@unframework/type-oracle";
import { typeOracleContract } from "@unframework/type-oracle/contract";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTsgoOracle } from "../src/index.ts";

typeOracleContract("tsgo", ({ root }) => createTsgoOracle({ root }), { checker: true });

/** The processes this test process started and has not reaped. */
function children(): string[] {
  try {
    return execFileSync("pgrep", ["-P", String(process.pid)], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Waits until none of `pids` runs: a killed process is reaped on a later turn of the loop. */
async function exited(pids: readonly string[]): Promise<void> {
  const deadline = Date.now() + 5000;
  while (pids.some((pid) => children().includes(pid))) {
    if (Date.now() > deadline) throw new Error(`Still running: ${pids.join(", ")}.`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

const canonical = (shape: TypeShape) => printShape(shape, { canonical: true });
const reasons = (shape: TypeShape) => shape.unresolved.map((entry) => entry.reason);

const KIND = 'type Kind<T> = T extends string ? "text" : "other";';

describe("tsgo adapter", () => {
  let root: string;
  let oracles: TypeOracle[];
  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), "uf-tsgo-")));
    oracles = [];
  });
  afterEach(async () => {
    for (const oracle of oracles) await oracle.dispose();
    await rm(root, { recursive: true, force: true });
  });

  const open = () => {
    const oracle = createTsgoOracle({ root });
    oracles.push(oracle);
    return oracle;
  };
  const put = async (file: string, source: string) => {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), source);
  };
  /** Writes `file`, `prelude` then `export function <head>(props: <type>) {}`. */
  const component = async (type: string, prelude = "", head = "A", file = "A.uf.tsx") => {
    const source = `${prelude}\nexport function ${head}(props: ${type}) {}\n`;
    await put(file, source);
    const start = source.lastIndexOf(type);
    return { file, span: { start, end: start + type.length } } satisfies ShapeQuery;
  };
  const resolve = async (type: string, prelude = "", head = "A"): Promise<TypeShape> =>
    open().resolveShape(await component(type, prelude, head));

  describe("its checker process", () => {
    it("starts only for a construct the syntactic adapter leaves, and stops on dispose", async () => {
      const before = new Set(children());
      const started = () => children().filter((pid) => !before.has(pid));
      const oracle = open();
      const plain = await component("{ a: string }");
      expect(canonical(await oracle.resolveShape(plain))).toBe("{ a: string }");
      expect(started()).toEqual([]);

      const mapped = await component('{ [K in "a" | "b"]: number }', "", "B", "B.uf.tsx");
      expect(canonical(await oracle.resolveShape(mapped))).toBe("{ a: number; b: number }");
      const checker = started();
      expect(checker).toHaveLength(1);

      await oracle.dispose();
      await exited(checker);
    });

    it("stops when a package changes, and starts again for the next query", async () => {
      const before = new Set(children());
      const oracle = open();
      const query = await component('{ [K in "a"]: number }');
      await oracle.resolveShape(query);
      const first = children().filter((pid) => !before.has(pid));
      expect(first).toHaveLength(1);

      await oracle.update({ files: ["pkg:kit"] });
      await exited(first);
      expect(canonical(await oracle.resolveShape(query))).toBe("{ a: number }");
      expect(children().filter((pid) => !before.has(pid) && !first.includes(pid))).toHaveLength(1);
    });
  });

  describe("update", () => {
    it("reads a changed file again", async () => {
      const oracle = open();
      await put("types.ts", 'export type Keys = "a";\n');
      const prelude = 'import type { Keys } from "./types.ts";';
      const query = await component("{ [K in Keys]: string }", prelude);
      expect(canonical(await oracle.resolveShape(query))).toBe("{ a: string }");

      await put("types.ts", 'export type Keys = "a" | "b";\n');
      await oracle.update({ files: ["types.ts"] });
      expect(canonical(await oracle.resolveShape(query))).toBe("{ a: string; b: string }");
    });

    it("reads a created file", async () => {
      const oracle = open();
      await oracle.resolveShape(await component('{ [K in "a"]: 1 }'));
      const source = 'export function N(props: { [K in "n"]: 2 }) {}\n';
      await put("N.uf.tsx", source);
      await oracle.update({ files: ["N.uf.tsx"] });
      const start = source.indexOf("{ [K");
      const shape = await oracle.resolveShape({
        file: "N.uf.tsx",
        span: { start, end: source.indexOf(") {}") },
      });
      expect(canonical(shape)).toBe("{ n: 2 }");
    });
  });

  describe("evaluates", () => {
    it.each([
      [
        "keyof, typeof, indexed access, template literals, booleans and literals",
        [
          // Text before the query that UTF-8 and UTF-16 count differently.
          "// Größe ✓",
          "const sizes = { sm: 1, md: 2 };",
          "interface Item { id: string; on: boolean | undefined; done: true; pair: [string, number?] }",
        ].join("\n"),
        '{ size: keyof typeof sizes; id: Item["id"]; on: Item["on"]; done: Item["done"]; pair: Item["pair"]; side: `${"top" | "bottom"}-end` }',
        '{ done: true; id: string; on: boolean | undefined; pair: [string, number?]; side: "bottom-end" | "top-end"; size: "md" | "sm" }',
      ],
      [
        "parts reached through arrays, tuples, parameters and returns",
        KIND,
        "{ list: Kind<string>[]; pair: [Kind<string>]; fn: (x: Kind<string>) => Kind<number> }",
        '{ fn: (x: "text") => "other"; list: "text"[]; pair: ["text"] }',
      ],
      [
        "every primitive",
        "interface P { a: any; b: unknown; c: bigint; d: symbol; e: object; f: null; g: undefined; h: void; i: never; j: number; k: string; l: boolean }",
        "{ [K in keyof P]: P[K] }",
        "{ a: any; b: unknown; c: bigint; d: symbol; e: object; f: null; g: undefined; h: void; i: never; j: number; k: string; l: boolean }",
      ],
      [
        "readonly arrays, and optional and rest parameters",
        "",
        '{ [K in "f"]: (a?: string, ...b: number[]) => readonly string[] }',
        "{ f: (a?: string, ...b: number[]) => readonly string[] }",
      ],
      [
        "a tuple's rest element, as its array",
        "",
        "[string, ...number[]] extends infer P ? P : never",
        "[string, ...number[]]",
      ],
      [
        "a mapped type's readonly",
        "interface B { a: string }",
        "{ readonly [K in keyof B]: B[K] }",
        "{ readonly a: string }",
      ],
      [
        "a mapped type's -readonly",
        "interface B { readonly a: string; b: number }",
        "{ -readonly [K in keyof B]: B[K] }",
        "{ a: string; b: number }",
      ],
    ])("%s", async (_, prelude, type, expected) => {
      const shape = await resolve(type, prelude);
      expect(canonical(shape)).toBe(expected);
      expect(shape.unresolved).toEqual([]);
    });
  });

  describe("keeps unresolved", () => {
    it.each([
      ["a mapped type over generic keys", "", "{ [K in keyof T]: T[K] }", "(unresolved)", "A<T>"],
      [
        "a mapped type over keys partly generic",
        "",
        '{ x: Record<keyof T | "a", 1> }',
        "{ x: (unresolved) }",
        "A<T>",
      ],
      ["an enum", 'enum E { X = "x", Y = "y" }', "{ a: E }", "{ a: (unresolved) }"],
      ["an enum a mapped type holds", 'enum E { X = "x" }', '{ [K in "a"]: E }', "(unresolved)"],
      ["a class", "class Box { v = 1 }", '{ [K in "a"]: Box }', "(unresolved)"],
      ["a generic signature", "", '{ [K in "a"]: <T>(x: T) => T }', "(unresolved)"],
      ["an accessor", "interface Acc { get a(): string }", '{ [K in "x"]: Acc }', "(unresolved)"],
      [
        "overloads",
        "interface O { f(a: string): void; f(a: number): void }",
        '{ [K in "x"]: O }',
        "(unresolved)",
      ],
      ["an index signature", "", '{ [K in "a"]: { [key: string]: number } }', "(unresolved)"],
      [
        "a symbol key",
        "declare const s: unique symbol;\ninterface S { [s]: string }",
        '{ [K in "x"]: S }',
        "(unresolved)",
      ],
      ["a lib type", "", '{ [K in "a"]: Date }', "(unresolved)"],
      ["a lib alias, whose file has no name (P8)", "", 'Record<"x", string>', "(unresolved)"],
      [
        "a type that expands without end",
        "type Wrap<T> = { inner: Wrap<[T]> };",
        '{ [K in "a"]: Wrap<string> }',
        "(unresolved)",
      ],
    ])("%s", async (_, prelude, type, expected, head = "A") => {
      const shape = await resolve(type, prelude, head);
      expect(canonical(shape)).toBe(expected);
      expect(reasons(shape)).toEqual(["unsupported"]);
    });

    it("a part reached only through a union", async () => {
      const shape = await resolve("{ a: Kind<string>; b: Kind<string> | number }", KIND);
      expect(canonical(shape)).toBe('{ a: "text"; b: (unresolved) | number }');
      expect(reasons(shape)).toEqual(["unsupported"]);
    });

    it("a conflict, which is not the checker's to settle", async () => {
      const shape = await resolve("{ a: string; c: Kind<string> } & { a: number }", KIND);
      expect(canonical(shape)).toBe('{ a: (unresolved); c: "text" }');
      expect(reasons(shape)).toEqual(["conflict"]);
    });
  });

  describe("names where a member comes from", () => {
    it("by its declaration, file, span, type as written and references", async () => {
      const types = [
        "interface Item { id: string }",
        "export interface Box<T> { value: T; items: Array<Item> }",
        "",
      ].join("\n");
      await put("types.ts", types);
      const prelude = 'import type { Box } from "./types.ts";';
      const shape = await resolve(
        "{ a: Kind<string> extends string ? Box<number> : never }",
        `${KIND}\n${prelude}`,
      );
      const object = shape.nodes[shape.nodes[shape.root]!.kind === "object" ? shape.root : -1]!;
      expect(object.kind).toBe("object");
      const box = object.kind === "object" ? shape.nodes[object.members[0]!.type]! : undefined;
      expect(box).toMatchObject({
        kind: "object",
        declaration: { file: "types.ts", name: "Box", exported: true },
      });
      if (box?.kind !== "object") return;
      expect(box.typeArguments!.map((id) => shape.nodes[id])).toEqual([
        { kind: "primitive", name: "number" },
      ]);
      const value = box.members.find((member) => member.name === "value")!;
      expect(value).toMatchObject({
        file: "types.ts",
        declaration: { file: "types.ts", name: "Box", exported: true },
        span: { start: types.indexOf("value: T;"), end: types.indexOf("value: T;") + 9 },
        typeText: { code: "T", span: { start: types.indexOf("T;"), end: types.indexOf("T;") + 1 } },
        references: ["T"],
      });
      const items = box.members.find((member) => member.name === "items")!;
      expect(items.typeText!.code).toBe("Array<Item>");
      expect(items.references).toEqual(["Array", "Item"]);
      expect(shape.dependencies).toEqual(["types.ts"]);
    });

    it("by a declaration its module does not export", async () => {
      const prelude = `${KIND}\ninterface Local { a: string }`;
      const shape = await resolve("{ x: Kind<string> extends string ? Local : never }", prelude);
      const object = shape.nodes[shape.root]!;
      const local = object.kind === "object" ? shape.nodes[object.members[0]!.type] : undefined;
      expect(local).toMatchObject({
        declaration: { file: "A.uf.tsx", name: "Local", exported: false },
      });
      expect(shape.dependencies).toEqual([]);
    });

    it("by the declaration a mapped member maps, with no type as written", async () => {
      await put("types.ts", "export interface Base { readonly a: string; b?: number }\n");
      const prelude = 'import type { Base } from "./types.ts";';
      const shape = await resolve("{ [K in keyof Base]-?: Array<Base[K]> }", prelude);
      expect(canonical(shape)).toBe("{ readonly a: string[]; b: (number | undefined)[] }");
      const object = shape.nodes[shape.root]!;
      expect(object.kind === "object" && object.members).toMatchObject([
        { declaration: { file: "types.ts", name: "Base", exported: true }, references: [] },
        { declaration: { file: "types.ts", name: "Base", exported: true }, references: [] },
      ]);
      expect(object.kind === "object" && object.members.map((member) => member.typeText)).toEqual([
        undefined,
        undefined,
      ]);
      expect(shape.dependencies).toEqual(["types.ts"]);
    });

    it("at the mapped type, for a member made from keys alone", async () => {
      const type = '{ [K in "a"]: string }';
      const shape = await resolve(type);
      const object = shape.nodes[shape.root]!;
      expect(object.kind === "object" && object.members[0]).toMatchObject({
        file: "A.uf.tsx",
        references: [],
      });
      expect(object.kind === "object" && object.members[0]!.declaration).toBeUndefined();
    });

    it("by its package, for a package's file", async () => {
      await put("node_modules/kit/package.json", '{ "name": "kit", "types": "index.d.ts" }');
      await put("node_modules/kit/index.d.ts", "export interface K { a: string }\n");
      await put("node_modules/z/package.json", '{ "name": "z", "types": "__gen/types.d.ts" }');
      await put("node_modules/z/__gen/types.d.ts", "export interface Z { b: string }\n");
      await put("node_modules/@types/scope__x/package.json", '{ "name": "@types/scope__x" }');
      await put("node_modules/@types/scope__x/index.d.ts", "export interface X { c: string }\n");
      const prelude = [
        KIND,
        'import type { K } from "kit";',
        'import type { Z } from "z";',
        'import type { X } from "@scope/x";',
      ].join("\n");
      const shape = await resolve(
        "{ k: Kind<string> extends string ? K : never; z: Kind<string> extends string ? Z : never; x: Kind<string> extends string ? X : never }",
        prelude,
      );
      const object = shape.nodes[shape.root]!;
      if (object.kind !== "object") throw new Error("not an object");
      const files = object.members.map((member) => {
        const inner = shape.nodes[member.type]!;
        return inner.kind === "object" ? inner.members[0]!.file : undefined;
      });
      expect(files.toSorted((a, b) => a!.localeCompare(b!))).toEqual([
        "pkg:@scope/x/index.d.ts",
        "pkg:kit/index.d.ts",
        "pkg:z/__gen/types.d.ts",
      ]);
      expect(shape.dependencies).toEqual(["pkg:@scope/x", "pkg:kit", "pkg:z"]);
    });
  });

  describe("printType", () => {
    it("prints what tsgo evaluated", async () => {
      const query = await component('{ [K in "a" | "b"]: number }');
      expect(await open().printType(query)).toBe("{ a: number; b: number }");
    });

    it("rejects a type with unresolved parts", async () => {
      const query = await component("{ [K in keyof T]: T[K] }", "", "A<T>");
      await expect(open().printType(query)).rejects.toThrow(/unresolved parts/);
    });
  });
});
