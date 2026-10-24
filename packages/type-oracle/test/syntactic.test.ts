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
    ["NS.P", "qualified-name"],
  ])("leaves %s unresolved, as %s", async (type, construct) => {
    const source = `type P = { a: string };\ntype Wrap<T> = T;\nfunction C(props: ${type}) {}`;
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
    expect(shape.unresolved).toEqual([
      {
        file: "C.uf.tsx",
        span: { start: source.indexOf("a: number"), end: source.indexOf("a: number") + 10 },
        reason: "conflict",
      },
    ]);
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

  it("leaves an overloaded method unresolved, and keeps the other members", async () => {
    const source =
      "interface P { f(a: string): void; f(a: number): void; g(): void }\nfunction C(props: P) {}";
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "P"));
    expect(printShape(shape)).toBe("{ g: () => void }");
    expect(shape.construction).toEqual(["overload"]);
    expect(shape.unresolved).toEqual([
      {
        file: "C.uf.tsx",
        span: {
          start: source.indexOf("f(a: number)"),
          end: source.indexOf("f(a: number)") + "f(a: number): void;".length,
        },
        reason: "unsupported",
      },
    ]);
  });

  it("reports a member that merged interfaces declare with different types", async () => {
    const source = "interface P { a: string }\ninterface P { a: number }\nfunction C(props: P) {}";
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "P"));
    expect(printShape(shape)).toBe("{ a: string }");
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["conflict"]);
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

  it("reads `..` as a relative specifier, not a package", async () => {
    const source = 'import type { P } from "..";\nfunction C(props: P) {}';
    const { oracle } = memory({ "src/C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("src/C.uf.tsx", source, "props: ", "P"));
    expect(shape.dependencies).toEqual([]);
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["missing-module"]);
  });

  it("leaves a number literal JSON cannot hold unresolved", async () => {
    const source = "function C(props: { a: 1e400 }) {}";
    const { oracle } = memory({ "C.uf.tsx": source });
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", "{ a: 1e400 }"));
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["unsupported"]);
    expect(JSON.parse(JSON.stringify(shape))).toEqual(shape);
  });
});

describe("printShape", () => {
  it("parenthesises what binds looser than `[]` and `?`", async () => {
    const source = "function C(props: { a: (readonly string[])[]; b: [(string | number)?] }) {}";
    const { oracle } = memory({ "C.uf.tsx": source });
    const type = "{ a: (readonly string[])[]; b: [(string | number)?] }";
    const shape = await oracle.resolveShape(at("C.uf.tsx", source, "props: ", type));
    expect(printShape(shape)).toBe("{ a: (readonly string[])[]; b: [(string | number)?] }");
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
