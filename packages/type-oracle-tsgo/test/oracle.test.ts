import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { printShape } from "@unframework.dev/type-oracle";
import type {
  DirectiveValueQuery,
  ShapeQuery,
  TypeOracle,
  TypeShape,
} from "@unframework.dev/type-oracle";
import { typeOracleContract } from "@unframework.dev/type-oracle/contract";
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
  // The root is a directory of `base`, so a test can write a file outside it.
  let base: string;
  let root: string;
  let oracles: TypeOracle[];
  beforeEach(async () => {
    base = await realpath(await mkdtemp(join(tmpdir(), "uf-tsgo-")));
    root = join(base, "root");
    await mkdir(root);
    oracles = [];
  });
  afterEach(async () => {
    for (const oracle of oracles) await oracle.dispose();
    await rm(base, { recursive: true, force: true });
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
  const pkg = async (directory: string, name: string, version: string, types: string) => {
    await put(`${directory}/package.json`, JSON.stringify({ name, version, types: "index.d.ts" }));
    await put(`${directory}/index.d.ts`, types);
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
      expect(started()).toEqual([]);
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

    it("keeps answering after an update that changes nothing", async () => {
      const oracle = open();
      await put("types.ts", 'export type Keys = "a";\n');
      const prelude = 'import type { Keys } from "./types.ts";';
      const query = await component("{ [K in Keys]: string }", prelude);
      expect(canonical(await oracle.resolveShape(query))).toBe("{ a: string }");

      await oracle.update({ files: [] });
      expect(canonical(await oracle.resolveShape(query))).toBe("{ a: string }");
      await oracle.update({ files: ["types.ts"] });
      expect(canonical(await oracle.resolveShape(query))).toBe("{ a: string }");
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
      ["a construct signature", "", '{ [K in "a"]: { new (): object } }', "(unresolved)"],
      [
        "a callable object with members",
        "interface F { (x: number): void; p: string }",
        '{ [K in "a"]: F }',
        "(unresolved)",
      ],
      [
        "a type parameter part of an intersection",
        "",
        '{ a: { z: T & { y: string } }["z"] }',
        "{ a: (unresolved) }",
        "A<T>",
      ],
      [
        "a callable intersection",
        "",
        '{ [K in "a"]: ((x: number) => void) & { b: 1 } }',
        "(unresolved)",
      ],
      [
        "a generic mapped part of an intersection",
        "",
        '{ a: { z: Partial<T> & { y: string } }["z"] }',
        "{ a: (unresolved) }",
        "A<T>",
      ],
      [
        "a generic mapped part of an intersection, after another part",
        "",
        '{ a: { z: { y: string } & Partial<T> }["z"] }',
        "{ a: (unresolved) }",
        "A<T>",
      ],
      [
        "a class in an intersection, after another part",
        'class C { private p = 1; protected q = 1; r = "" }',
        '{ a: { z: { y: string } & C }["z"] }',
        "{ a: (unresolved) }",
      ],
      [
        "a class in an intersection",
        'class C { private p = 1; protected q = 1; r = "" }',
        '{ a: { z: C & { y: string } }["z"] }',
        "{ a: (unresolved) }",
      ],
      [
        "a member declared outside the root, in no named declaration",
        'import { o } from "../outside.ts";',
        '{ [K in "a"]: typeof o }',
        "(unresolved)",
      ],
      [
        "a type that expands without end",
        "type Wrap<T> = { inner: Wrap<[T]> };",
        '{ [K in "a"]: Wrap<string> }',
        "(unresolved)",
      ],
    ])("%s", async (_, prelude, type, expected, head = "A") => {
      await writeFile(join(base, "outside.ts"), "export declare const o: { o: string };\n");
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

  it.each([
    ["{ readonly x: string } & { x: string }", "{ a: { x: string } }"],
    ["{ x: string } & { readonly x: string }", "{ a: { x: string } }"],
    ["{ readonly x: string } & { readonly x: string }", "{ a: { readonly x: string } }"],
  ])(
    "makes an intersection's member readonly only when each part does: %s",
    async (parts, expected) => {
      const shape = await resolve(`{ a: { z: ${parts} }["z"] }`);
      expect(canonical(shape)).toBe(expected);
      const object = shape.nodes[shape.root]!;
      const inner = object.kind === "object" ? shape.nodes[object.members[0]!.type] : undefined;
      expect(inner?.kind === "object" && inner.members[0]!.typeText).toBeUndefined();
    },
  );

  it.each([
    [
      "an import of a missing module",
      'import type { Missing } from "./nope.ts";',
      '{ a: Missing extends string ? "a" : "b" }',
    ],
    ["a missing namespace", "", "{ a: keyof NoSuch.X }"],
    ["a name declared nowhere", "", "{ a: keyof Missing }"],
    ["a missing export", 'import type { Gone } from "./b.ts";', "{ a: keyof Gone }"],
    [
      "a missing name in a declaration it reaches",
      'import type { X } from "./x.ts";',
      "{ a: keyof X }",
    ],
  ])("keeps unresolved a construct that names something missing: %s", async (_, prelude, type) => {
    await put("b.ts", "export interface B { x: string }\n");
    await put("x.ts", "export type X = { p: Missing };\n");
    const shape = await resolve(type, prelude);
    expect(canonical(shape)).toBe("{ a: (unresolved) }");
    expect(reasons(shape)).toContain("unsupported");
  });

  it.each([
    [
      "the const of `as const`",
      'const xs = ["a", "b"] as const;',
      "{ a: (typeof xs)[number] }",
      '{ a: "a" | "b" }',
    ],
    [
      "`as const` on an object",
      "const v = { sm: 1, md: 2 } as const;",
      "{ a: keyof typeof v }",
      '{ a: "md" | "sm" }',
    ],
    ["`undefined`", "", "{ a: typeof undefined }", "{ a: undefined }"],
    [
      "a mixin's call",
      [
        "function Mix<T extends new (...args: any[]) => object>(B: T) { return class extends B { m() {} }; }",
        "class Base { x = 1 }",
        "class C extends Mix(Base) { b = 1 }",
      ].join("\n"),
      "{ a: keyof C }",
      '{ a: "b" | "m" | "x" }',
    ],
  ])(
    "evaluates a name with no declaration that is not missing: %s",
    async (_, prelude, type, expected) => {
      const shape = await resolve(type, prelude);
      expect(canonical(shape)).toBe(expected);
      expect(shape.unresolved).toEqual([]);
    },
  );

  it("keeps unresolved a missing name in a declaration outside the root", async () => {
    await writeFile(join(base, "outside.ts"), "export type O = keyof Missing;\n");
    const prelude = 'import type { O } from "../outside.ts";';
    const shape = await resolve("{ a: O extends infer U ? U : never }", prelude);
    expect(canonical(shape)).toBe("{ a: (unresolved) }");
  });

  it("keeps unresolved a part whose text is not a type node it can read", async () => {
    // The member `m` that `I` inherits beside a computed key is kept opaque at its signature.
    const prelude =
      "declare const k: string;\ninterface B { m(): void }\ninterface I extends B { [k]: number }";
    const shape = await resolve("I", prelude);
    expect(canonical(shape)).toBe("{ m: (unresolved) }");
  });

  it("follows an alias chain as long as a project makes it", async () => {
    const chain = Array.from({ length: 2000 }, (_, index) => `type T${index} = T${index + 1};`);
    const shape = await resolve(
      "{ a: keyof T0 }",
      [...chain, "type T2000 = { p: string };"].join("\n"),
    );
    expect(canonical(shape)).toBe('{ a: "p" }');
  });

  it("lists a module an import type reads without a qualifier, and none it imports", async () => {
    await put(
      "c.ts",
      'import type { E } from "./e.ts";\nexport const k = 1;\nexport type C2 = E;\n',
    );
    await put("e.ts", "export type E = string;\n");
    const shape = await resolve('{ a: keyof typeof import("./c.ts") }');
    expect(canonical(shape)).toBe('{ a: "k" }');
    expect(shape.dependencies).toEqual(["c.ts"]);
  });

  it("lists the files an import type and a typeof read", async () => {
    await put(
      "b.ts",
      'import type { D } from "./d.ts";\nexport interface B extends D { x: string }\n',
    );
    await put("d.ts", "export interface D { y: string }\n");
    await put("c.ts", "export const c = { k: 1 };\n");
    const prelude = 'import { c } from "./c.ts";';
    const shape = await resolve('{ a: keyof import("./b.ts").B; b: keyof typeof c }', prelude);
    expect(canonical(shape)).toBe('{ a: "x" | "y"; b: "k" }');
    expect(shape.dependencies).toEqual(["b.ts", "c.ts", "d.ts"]);
  });

  it("lists the files a construct reads, though its result names none", async () => {
    await put("X.ts", 'import type { Y } from "./Y.ts";\nexport type X = Y;\n');
    await put("Y.ts", "export interface Y { p: string; q: string }\n");
    const shape = await resolve('{ a: keyof X; b: X["p"] }', 'import type { X } from "./X.ts";');
    expect(canonical(shape)).toBe('{ a: "p" | "q"; b: string }');
    expect(shape.dependencies).toEqual(["X.ts", "Y.ts"]);
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

  describe("names a package's copies as the syntactic adapter does", () => {
    beforeEach(async () => {
      await pkg("node_modules/twin", "twin", "1.0.0", "export interface Twin { v1: string }\n");
      await pkg(
        "node_modules/user",
        "user",
        "1.0.0",
        'import type { Twin } from "twin";\nexport interface Uses { twin: Twin }\n',
      );
      await pkg(
        "node_modules/user/node_modules/twin",
        "twin",
        "2.0.0",
        "export interface Twin { v2: string }\n",
      );
      await pkg(
        "node_modules/ui-deep",
        "ui-deep",
        "1.0.0",
        'import type { DeepBase } from "@deep/tokens";\nexport interface DeepProps extends DeepBase { tone: string }\n',
      );
      await pkg(
        "node_modules/ui-deep/node_modules/@deep/tokens",
        "@deep/tokens",
        "2.0.0",
        "export interface DeepBase { id: string }\n",
      );
    });

    it("leaves a copy other than the root's unnamed", async () => {
      const prelude = `${KIND}\nimport type { Uses } from "user";`;
      const shape = await resolve("{ a: Kind<string> extends string ? Uses : never }", prelude);
      expect(canonical(shape)).toBe("{ a: (unresolved) }");
    });

    it("leaves unnamed a copy other than the one the root resolves its types from", async () => {
      await pkg("node_modules/@types/w", "@types/w", "1.0.0", "export interface W { a: string }\n");
      await pkg(
        "node_modules/x",
        "x",
        "1.0.0",
        'import type { W } from "w";\nexport interface XP { w: W }\n',
      );
      await pkg(
        "node_modules/x/node_modules/w",
        "w",
        "5.0.0",
        "export interface W { b: string }\n",
      );
      const prelude = `${KIND}\nimport type { XP } from "x";`;
      const shape = await resolve("{ a: Kind<string> extends string ? XP : never }", prelude);
      expect(canonical(shape)).toBe("{ a: (unresolved) }");
    });

    it.each([
      [
        "its `exports`",
        { name: "w", version: "1.0.0", exports: { ".": { types: "./dist/w.d.ts" } } },
        "dist/w.d.ts",
      ],
      ["an `index.d.ts`", { name: "w", version: "1.0.0" }, "index.d.ts"],
      ["its `types`", { name: "w", version: "1.0.0", types: "w.d.ts" }, "w.d.ts"],
    ])(
      "names a package that declares its types by %s over its @types/ package",
      async (_, manifest, types) => {
        await put("node_modules/w/package.json", JSON.stringify(manifest));
        await put(`node_modules/w/${types}`, "export interface W { a: string }\n");
        await pkg(
          "node_modules/@types/w",
          "@types/w",
          "1.0.0",
          "export interface W { b: string }\n",
        );
        const prelude = `${KIND}\nimport type { W } from "w";`;
        const shape = await resolve("{ a: Kind<string> extends string ? W : never }", prelude);
        expect(canonical(shape)).toBe("{ a: { a: string } }");
        const object = shape.nodes[shape.root]!;
        const w = object.kind === "object" ? shape.nodes[object.members[0]!.type] : undefined;
        expect(w?.kind === "object" && w.members[0]!.file).toBe(`pkg:w/${types}`);
      },
    );

    it("names a package typed by its @types/ package, beside an untyped copy", async () => {
      await put("node_modules/w/package.json", '{ "name": "w", "version": "1.0.0" }');
      await put("node_modules/w/index.js", "export {};\n");
      await pkg("node_modules/@types/w", "@types/w", "1.0.0", "export interface W { a: string }\n");
      const prelude = `${KIND}\nimport type { W } from "w";`;
      const shape = await resolve("{ a: Kind<string> extends string ? W : never }", prelude);
      const object = shape.nodes[shape.root]!;
      const w = object.kind === "object" ? shape.nodes[object.members[0]!.type] : undefined;
      expect(w?.kind === "object" && w.members[0]!.file).toBe("pkg:w/index.d.ts");
    });

    it("lists the packages a construct in a package's file reads", async () => {
      await pkg(
        "node_modules/ui",
        "ui",
        "1.0.0",
        'import type { Other } from "other";\nexport type P = { a: keyof Other };\n',
      );
      await pkg("node_modules/other", "other", "1.0.0", "export interface Other { o: string }\n");
      const shape = await resolve("P", 'import type { P } from "ui";');
      expect(canonical(shape)).toBe('{ a: "o" }');
      expect(shape.dependencies).toEqual(["pkg:other", "pkg:ui"]);
    });

    it("names a copy the root resolves none of by its version", async () => {
      const prelude = `${KIND}\nimport type { DeepProps } from "ui-deep";`;
      const shape = await resolve(
        "{ a: Kind<string> extends string ? DeepProps : never }",
        prelude,
      );
      expect(canonical(shape)).toBe("{ a: { id: string; tone: string } }");
      const object = shape.nodes[shape.root]!;
      const deep = object.kind === "object" ? shape.nodes[object.members[0]!.type] : undefined;
      expect(
        deep?.kind === "object" && deep.members.map((member) => member.file).toSorted(),
      ).toEqual(["pkg:@deep/tokens@2.0.0/index.d.ts", "pkg:ui-deep/index.d.ts"]);
      expect(shape.dependencies).toEqual(["pkg:@deep/tokens", "pkg:ui-deep"]);
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

  describe("checkDirectiveValues", () => {
    /** The authoring package's types a directive's check reads, as `@uxfront/unframework` declares them. */
    const AUTHORING = [
      "declare const directiveBrand: unique symbol;",
      "export interface Directive<T, E extends globalThis.Element = HTMLElement> {",
      "  readonly [directiveBrand]: { value: T; element: E };",
      "}",
      "export declare function defineDirective<T = never, E extends globalThis.Element = HTMLElement>(",
      "  hooks: { mounted?(el: E, value: T): void },",
      "): Directive<T, E>;",
      "export interface Ref<T> { value: T }",
      "export declare function ref<T>(value: T): Ref<T>;",
      "export declare function ref<T>(): Ref<T | undefined>;",
      "export declare function computed<T>(getter: () => T): { readonly value: T };",
      "",
    ].join("\n");
    const MANIFEST = JSON.stringify({ name: "@uxfront/unframework", types: "index.d.ts" });

    /** Installs the authoring package in the root's `node_modules`. */
    const authoring = async () => {
      await put("node_modules/@uxfront/unframework/package.json", MANIFEST);
      await put("node_modules/@uxfront/unframework/index.d.ts", AUTHORING);
    };

    /**
     * The query for an attribute written in `source`, `v-tone="warn"` or `v-box={good.value}`,
     * whose directive is the first `name` the source writes: its `const` or its import.
     */
    const use = (
      source: string,
      attribute: string,
      name: string,
      occurrence = 0,
    ): DirectiveValueQuery => {
      let at = source.indexOf(attribute);
      for (let skip = occurrence; skip > 0 && at !== -1; skip--) {
        at = source.indexOf(attribute, at + 1);
      }
      if (at === -1) throw new Error(`No ${attribute} in the source.`);
      const equals = attribute.indexOf("=");
      const braced = attribute[equals + 1] === "{";
      const length = attribute.length - equals - 1 - (braced ? 2 : 0);
      const start = at + equals + (braced ? 2 : 1);
      const directive = source.indexOf(name);
      return {
        value: { start, end: start + length },
        directive: { start: directive, end: directive + name.length },
      };
    };

    const FOCUS = [
      'import { defineDirective } from "@uxfront/unframework";',
      "export const vFocusTrap = defineDirective<boolean>({});",
      'export const vTone = defineDirective<"info" | "warn">({});',
      "",
    ].join("\n");
    const CAST = "export function cast<T>(value: unknown): T {\n  return value as T;\n}\n";
    const PANEL = [
      'import { computed, defineDirective, ref } from "@uxfront/unframework";',
      'import { cast } from "./cast.ts";',
      'import { vFocusTrap, vTone } from "./focus.uf.ts";',
      "const vBox = defineDirective<{ id: string }>({});",
      "const vLabel = defineDirective<string>({});",
      "const vPrefixed = defineDirective<`x-${string}`>({});",
      "export default function Panel() {",
      "  const open = ref(false);",
      '  const tone = ref<"info" | "warn">();',
      "  const n = ref(1);",
      '  const bad = computed(() => ({ name: "a" }));',
      '  const good = computed(() => ({ id: "a" }));',
      "  return (",
      '    <div v-focus-trap={1} v-tone="loud" v-prefixed="x-1">',
      '      <p v-focus-trap={open.value} v-tone="warn" v-box={bad.value} v-label="x" />',
      "      {tone.value !== undefined && <span v-tone={tone.value} v-box={good.value} />}",
      "      {tone.value !== undefined && <i v-tone={`${tone.value}`} />}",
      "      <b v-prefixed={`x-${n.value}`} v-focus-trap={cast(1)} v-tone={tone.value} />",
      "    </div>",
      "  );",
      "}",
      "",
    ].join("\n");
    const PANEL_USES: [string, string, unknown][] = [
      ["v-focus-trap={1}", "vFocusTrap", { assignable: false, value: "1", expected: "boolean" }],
      [
        'v-tone="loud"',
        "vTone",
        { assignable: false, value: '"loud"', expected: '"info" | "warn"' },
      ],
      [
        'v-prefixed="x-1"',
        "vPrefixed",
        { assignable: true, value: '"x-1"', expected: "`x-${string}`" },
      ],
      [
        "v-focus-trap={open.value}",
        "vFocusTrap",
        { assignable: true, value: "boolean", expected: "boolean" },
      ],
      [
        'v-tone="warn"',
        "vTone",
        { assignable: true, value: '"warn"', expected: '"info" | "warn"' },
      ],
      [
        "v-box={bad.value}",
        "vBox",
        { assignable: false, value: "{ name: string; }", expected: "{ id: string; }" },
      ],
      ['v-label="x"', "vLabel", { assignable: true, value: '"x"', expected: "string" }],
      [
        "v-tone={tone.value}",
        "vTone",
        { assignable: true, value: '"info" | "warn"', expected: '"info" | "warn"' },
      ],
      [
        "v-box={good.value}",
        "vBox",
        { assignable: true, value: "{ id: string; }", expected: "{ id: string; }" },
      ],
      // QA's three: values TypeScript types by what they are given to.
      [
        "v-tone={`${tone.value}`}",
        "vTone",
        { assignable: true, value: '"info" | "warn"', expected: '"info" | "warn"' },
      ],
      [
        "v-prefixed={`x-${n.value}`}",
        "vPrefixed",
        { assignable: true, value: "`x-${number}`", expected: "`x-${string}`" },
      ],
      [
        "v-focus-trap={cast(1)}",
        "vFocusTrap",
        { assignable: true, value: "boolean", expected: "boolean" },
      ],
      // Not narrowed: a real mismatch.
      [
        "v-tone={tone.value}#1",
        "vTone",
        {
          assignable: false,
          value: '"info" | "warn" | undefined',
          expected: '"info" | "warn"',
        },
      ],
    ];
    /** The queries of `PANEL_USES` in `source`: `#1` names an attribute's second use. */
    const panelQueries = (source: string) =>
      PANEL_USES.map(([attribute, name]) => {
        const [written, occurrence] = attribute.split("#");
        return use(source, written!, name, Number(occurrence ?? 0));
      });
    const PANEL_CHECKS = PANEL_USES.map(([, , check]) => check);
    const writePanel = async () => {
      await put("cast.ts", CAST);
      await put("focus.uf.ts", FOCUS);
      await put("Panel.uf.tsx", PANEL);
    };

    it("checks each value against its directive's type, as given to it, narrowed, local or imported", async () => {
      await authoring();
      await writePanel();
      expect(
        await open().checkDirectiveValues!("Panel.uf.tsx", PANEL, panelQueries(PANEL)),
      ).toEqual({
        checks: PANEL_CHECKS,
        dependencies: ["focus.uf.ts"],
      });
    });

    it("reads the authoring package through a link outside the root, as a workspace has it", async () => {
      await put("../authoring/package.json", MANIFEST);
      await put("../authoring/index.d.ts", AUTHORING);
      await mkdir(join(root, "node_modules/@uxfront"), { recursive: true });
      await symlink(join(base, "authoring"), join(root, "node_modules/@uxfront/unframework"));
      await writePanel();
      const { checks } = await open().checkDirectiveValues!(
        "Panel.uf.tsx",
        PANEL,
        panelQueries(PANEL),
      );
      expect(checks).toEqual(PANEL_CHECKS);
    });

    it("answers null where it cannot say, and reports nothing", async () => {
      await authoring();
      await put(
        "types.ts",
        "export interface Directive<T> { value: T }\nexport declare const vForeign: Directive<boolean>;\n",
      );
      const source = [
        'import { defineDirective } from "@uxfront/unframework";',
        'import { vForeign } from "./types.ts";',
        "const vPlain = 1;",
        "const vMissing = defineDirective<Missing>({});",
        "const vUntyped = defineDirective({});",
        "export default function A() {",
        "  return <div v-plain={1} v-foreign={1} v-missing={1} v-untyped={1} />;",
        "}",
        "",
      ].join("\n");
      await put("A.uf.tsx", source);
      const { checks } = await open().checkDirectiveValues!("A.uf.tsx", source, [
        use(source, "v-plain={1}", "vPlain"),
        use(source, "v-foreign={1}", "vForeign"),
        use(source, "v-missing={1}", "vMissing"),
        use(source, "v-untyped={1}", "vUntyped"),
      ]);
      expect(checks).toEqual([null, null, null, null]);
    });

    /** A file whose `v` the disk and the compiled source give different types. */
    const SWAP = [
      'import { defineDirective, ref } from "@uxfront/unframework";',
      "const vFlag = defineDirective<boolean>({});",
      "export default function A() {",
      "  const v = ref(10);",
      "  return <div v-flag={v.value} />;",
      "}",
      "",
    ].join("\n");

    it("types the source it is given, not the disk's", async () => {
      await authoring();
      const compiled = SWAP.replace("ref(10)", "ref(!0)");
      const oracle = open();
      await put("A.uf.tsx", SWAP);
      expect(
        (
          await oracle.checkDirectiveValues!("A.uf.tsx", compiled, [
            use(compiled, "v-flag={v.value}", "vFlag"),
          ])
        ).checks,
      ).toEqual([{ assignable: true, value: "boolean", expected: "boolean" }]);
      await put("A.uf.tsx", compiled);
      await oracle.update({ files: ["A.uf.tsx"] });
      expect(
        (
          await oracle.checkDirectiveValues!("A.uf.tsx", SWAP, [
            use(SWAP, "v-flag={v.value}", "vFlag"),
          ])
        ).checks,
      ).toEqual([{ assignable: false, value: "number", expected: "boolean" }]);
    });

    it("gives a source with a byte order mark the answers it gives one without", async () => {
      await authoring();
      await writePanel();
      const marked = `﻿${PANEL}`;
      const queries = panelQueries(PANEL).map(({ value, directive }) => ({
        value: { start: value.start + 1, end: value.end + 1 },
        directive: { start: directive.start + 1, end: directive.end + 1 },
      }));
      const { checks } = await open().checkDirectiveValues!("Panel.uf.tsx", marked, queries);
      expect(checks).toEqual(PANEL_CHECKS);
    });

    it("picks a helper name the source doesn't hold", async () => {
      await authoring();
      // A local of the helper's name would take the call, and the value would lose its context.
      const source = [
        'import { defineDirective } from "@uxfront/unframework";',
        "const vFlag = defineDirective<boolean>({});",
        "function cast<T>(value: unknown): T {",
        "  return value as T;",
        "}",
        "export default function A() {",
        "  const __ufDirectiveValue = 1;",
        "  return <div v-flag={cast(__ufDirectiveValue)} />;",
        "}",
        "",
      ].join("\n");
      await put("A.uf.tsx", source);
      const { checks } = await open().checkDirectiveValues!("A.uf.tsx", source, [
        use(source, "v-flag={cast(__ufDirectiveValue)}", "vFlag"),
      ]);
      expect(checks).toEqual([{ assignable: true, value: "boolean", expected: "boolean" }]);
    });

    it("leaves no shadow behind it", async () => {
      await authoring();
      await writePanel();
      await put("B.uf.tsx", SWAP);
      // A script's shadow declares its helper globally: once the shadow is gone, no type reads it.
      const script = [
        'declare const vFlag: import("@uxfront/unframework").Directive<boolean>;',
        "function S() {",
        "  return <div v-flag={1} />;",
        "}",
        "",
      ].join("\n");
      await put("S.uf.tsx", script);
      const helper = await component(
        "{ a: ReturnType<typeof __ufDirectiveValue> }",
        "",
        "H",
        "H.uf.tsx",
      );
      const mapped = await component('{ [K in "a"]: number }', "", "M", "M.uf.tsx");
      const oracle = open();
      await oracle.checkDirectiveValues!("Panel.uf.tsx", PANEL, panelQueries(PANEL));
      // A shape the checker evaluates, and a second check, each in a program with no shadow.
      const shape = await oracle.resolveShape(mapped);
      expect(canonical(shape)).toBe("{ a: number }");
      expect(shape.dependencies.some((file) => file.includes("uf-directive-values"))).toBe(false);
      const again = await oracle.checkDirectiveValues!("B.uf.tsx", SWAP, [
        use(SWAP, "v-flag={v.value}", "vFlag"),
      ]);
      expect(again.checks).toEqual([{ assignable: false, value: "number", expected: "boolean" }]);
      const answer = await oracle.checkDirectiveValues!("S.uf.tsx", script, [
        use(script, "v-flag={1}", "vFlag"),
      ]);
      expect(answer.checks).toEqual([{ assignable: false, value: "1", expected: "boolean" }]);
      expect((await oracle.resolveShape(helper)).unresolved).not.toEqual([]);
      // The same file checks again, after its shadow was removed.
      const { checks } = await oracle.checkDirectiveValues!(
        "Panel.uf.tsx",
        PANEL,
        panelQueries(PANEL),
      );
      expect(checks).toEqual(PANEL_CHECKS);
    });

    it("gives overlapping calls and an update each their own answers", async () => {
      await authoring();
      await writePanel();
      await put("B.uf.tsx", SWAP);
      const query = await component('{ [K in "b"]: string }');
      const oracle = open();
      const [panel, swap, , shape] = await Promise.all([
        oracle.checkDirectiveValues!("Panel.uf.tsx", PANEL, panelQueries(PANEL)),
        oracle.checkDirectiveValues!("B.uf.tsx", SWAP, [use(SWAP, "v-flag={v.value}", "vFlag")]),
        oracle.update({ files: ["focus.uf.ts"] }),
        oracle.resolveShape(query),
      ]);
      expect(panel.checks).toEqual(PANEL_CHECKS);
      expect(swap.checks).toEqual([{ assignable: false, value: "number", expected: "boolean" }]);
      expect(canonical(shape)).toBe("{ b: string }");
    });

    it("answers null for every use when the authoring package does not resolve", async () => {
      await writePanel();
      const queries = panelQueries(PANEL);
      const { checks } = await open().checkDirectiveValues!("Panel.uf.tsx", PANEL, queries);
      expect(checks).toEqual(queries.map(() => null));
    });

    it("starts no checker for a module with no use", async () => {
      const before = new Set(children());
      expect(await open().checkDirectiveValues!("A.uf.tsx", "", [])).toEqual({
        checks: [],
        dependencies: [],
      });
      expect(children().filter((pid) => !before.has(pid))).toEqual([]);
    });

    it("checks 200 uses in one call", async () => {
      await authoring();
      const attributes = Array.from({ length: 200 }, (_, index) =>
        index % 2 ? `v-flag={${index}}` : `v-flag={on${index}.value}`,
      );
      const source = [
        'import { defineDirective, ref } from "@uxfront/unframework";',
        "const vFlag = defineDirective<boolean>({});",
        "export default function A() {",
        ...attributes.map((_, index) => `  const on${index} = ref(false);`),
        "  return (",
        "    <div>",
        ...attributes.map((attribute) => `      <p ${attribute} />`),
        "    </div>",
        "  );",
        "}",
        "",
      ].join("\n");
      await put("A.uf.tsx", source);
      const { checks } = await open().checkDirectiveValues!(
        "A.uf.tsx",
        source,
        attributes.map((attribute) => use(source, attribute, "vFlag")),
      );
      expect(checks).toHaveLength(200);
      expect(checks.map((check) => check?.assignable)).toEqual(
        attributes.map((_, index) => index % 2 === 0),
      );
    });

    it("reads a directive's changed type after an update", async () => {
      await authoring();
      const oracle = open();
      await writePanel();
      const query = use(PANEL, "v-focus-trap={1}", "vFocusTrap");
      expect((await oracle.checkDirectiveValues!("Panel.uf.tsx", PANEL, [query])).checks).toEqual([
        { assignable: false, value: "1", expected: "boolean" },
      ]);
      await put("focus.uf.ts", FOCUS.replace("<boolean>", "<number>"));
      await oracle.update({ files: ["focus.uf.ts"] });
      expect((await oracle.checkDirectiveValues!("Panel.uf.tsx", PANEL, [query])).checks).toEqual([
        { assignable: true, value: "1", expected: "number" },
      ]);
    });

    it("answers null for a file whose shadow its project leaves out", async () => {
      await authoring();
      await writePanel();
      await put("other/B.uf.tsx", SWAP);
      const oracle = createTsgoOracle({
        root,
        include: ["Panel.uf.tsx", "focus.uf.ts", "cast.ts"],
      });
      oracles.push(oracle);
      expect(
        (await oracle.checkDirectiveValues!("Panel.uf.tsx", PANEL, panelQueries(PANEL))).checks,
      ).toEqual(PANEL_CHECKS.map(() => null));
      const narrow = createTsgoOracle({ root, include: ["other/**/*"] });
      oracles.push(narrow);
      expect(
        (
          await narrow.checkDirectiveValues!("other/B.uf.tsx", SWAP, [
            use(SWAP, "v-flag={v.value}", "vFlag"),
          ])
        ).checks,
      ).toEqual([{ assignable: false, value: "number", expected: "boolean" }]);
    });

    it("reads the syntactic layer's files through `readFile`", async () => {
      await put("A.uf.tsx", "export function A(props: { a: string }) {}\n");
      const read: string[] = [];
      const oracle = createTsgoOracle({
        root,
        readFile: async (path) => {
          read.push(path);
          return path.endsWith("A.uf.tsx")
            ? "export function A(props: { b: number }) {}\n"
            : undefined;
        },
      });
      oracles.push(oracle);
      const start = "export function A(props: ".length;
      const shape = await oracle.resolveShape({
        file: "A.uf.tsx",
        span: { start, end: start + "{ b: number }".length },
      });
      expect(canonical(shape)).toBe("{ b: number }");
      expect(read).toContain(join(root, "A.uf.tsx"));
    });
  });
});
