import { execFileSync } from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { printShape } from "@unframework/type-oracle";
import type { ShapeQuery } from "@unframework/type-oracle";
import { typeOracleContract } from "@unframework/type-oracle/contract";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTsgoOracle } from "../src/index.ts";

typeOracleContract("tsgo", ({ root }) => createTsgoOracle({ root }), { checker: true });

/** The tsgo processes this test process started. */
function checkers(): string[] {
  try {
    return execFileSync("pgrep", ["-P", String(process.pid)], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

describe("tsgo adapter", () => {
  let root: string;
  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), "uf-tsgo-")));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  /** Writes `source` as `file` under the root, and the query for `type` after `after` in it. */
  async function write(file: string, source: string, after: string, type: string) {
    await writeFile(join(root, file), source);
    const start = source.indexOf(type, source.indexOf(after));
    return { file, span: { start, end: start + type.length } } satisfies ShapeQuery;
  }

  it("starts its checker only for a construct the syntactic adapter leaves", async () => {
    const before = checkers().length;
    const oracle = createTsgoOracle({ root });
    const plain = await write(
      "A.uf.tsx",
      "export function A(props: { a: string }) {}\n",
      "props",
      "{ a: string }",
    );
    expect(printShape(await oracle.resolveShape(plain))).toBe("{ a: string }");
    expect(checkers()).toHaveLength(before);

    const mapped = await write(
      "B.uf.tsx",
      'export function B(props: { [K in "a" | "b"]: number }) {}\n',
      "props",
      '{ [K in "a" | "b"]: number }',
    );
    expect(printShape(await oracle.resolveShape(mapped))).toBe("{ a: number; b: number }");
    expect(checkers()).toHaveLength(before + 1);

    await oracle.dispose();
    expect(checkers()).toHaveLength(before);
  });

  it("reads a changed file again after update", async () => {
    const oracle = createTsgoOracle({ root });
    await writeFile(join(root, "types.ts"), 'export type Keys = "a";\n');
    const source =
      'import type { Keys } from "./types.ts";\nexport function A(props: { [K in Keys]: string }) {}\n';
    const query = await write("A.uf.tsx", source, "props", "{ [K in Keys]: string }");
    expect(printShape(await oracle.resolveShape(query))).toBe("{ a: string }");

    await writeFile(join(root, "types.ts"), 'export type Keys = "a" | "b";\n');
    await oracle.update({ files: ["types.ts"] });
    expect(printShape(await oracle.resolveShape(query))).toBe("{ a: string; b: string }");
    await oracle.dispose();
  });

  it("evaluates keyof, typeof, indexed access and template literals", async () => {
    const oracle = createTsgoOracle({ root });
    const source = [
      // Text before the query that UTF-8 and UTF-16 count differently.
      "// Größe ✓",
      "const sizes = { sm: 1, md: 2 };",
      "interface Item { id: string; on: boolean | undefined; done: true; pair: [string, number?] }",
      "export function A(props: {",
      "  size: keyof typeof sizes;",
      '  id: Item["id"];',
      '  on: Item["on"];',
      '  done: Item["done"];',
      '  pair: Item["pair"];',
      '  side: `${"top" | "bottom"}-end`;',
      "}) {}",
      "",
    ].join("\n");
    const type = source.slice(source.indexOf("{\n"), source.indexOf(") {}"));
    const query = await write("A.uf.tsx", source, "props", type);
    const shape = await oracle.resolveShape(query);
    expect(printShape(shape, { canonical: true })).toBe(
      '{ done: true; id: string; on: boolean | undefined; pair: [string, number?]; side: "bottom-end" | "top-end"; size: "md" | "sm" }',
    );
    expect(shape.unresolved).toEqual([]);
    await oracle.dispose();
  });

  it("keeps what a shape cannot hold unresolved", async () => {
    const oracle = createTsgoOracle({ root });
    const source =
      "type Lookup = { [key: string]: number };\nexport function A(props: { a: Lookup extends object ? Lookup : never }) {}\n";
    const query = await write(
      "A.uf.tsx",
      source,
      "props",
      "{ a: Lookup extends object ? Lookup : never }",
    );
    const shape = await oracle.resolveShape(query);
    expect(printShape(shape, { canonical: true })).toBe("{ a: (unresolved) }");
    expect(shape.unresolved.map((entry) => entry.reason)).toEqual(["unsupported"]);
    await oracle.dispose();
  });

  it("names each member a mapped type makes over a declared one by its declaration", async () => {
    const oracle = createTsgoOracle({ root });
    await writeFile(
      join(root, "types.ts"),
      "export interface Base { readonly a: string; b?: number }\n",
    );
    const source =
      'import type { Base } from "./types.ts";\nexport function A(props: { [K in keyof Base]-?: Base[K] }) {}\n';
    const query = await write("A.uf.tsx", source, "props", "{ [K in keyof Base]-?: Base[K] }");
    const shape = await oracle.resolveShape(query);
    expect(printShape(shape, { canonical: true })).toBe("{ readonly a: string; b: number }");
    const object = shape.nodes[shape.root]!;
    expect(object.kind === "object" && object.members.map((member) => member.declaration)).toEqual([
      { file: "types.ts", name: "Base", exported: true },
      { file: "types.ts", name: "Base", exported: true },
    ]);
    expect(shape.dependencies).toEqual(["types.ts"]);
    await oracle.dispose();
  });
});
