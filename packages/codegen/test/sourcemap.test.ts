import { decodedMappings, originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import type { Code, CodeReference, UfModule } from "@unframework/ir";
import { format } from "oxfmt";
import { describe, expect, it } from "vitest";

import {
  anchorOutput,
  formatOutput,
  identityMapped,
  OUTPUT_FORMAT,
  remapFormatted,
} from "../src/index.ts";
import type { OutputFile, SourceMapV3 } from "../src/index.ts";

/** The `Code` covering `text` in `source`, with a reference at each of `refs`, by their text. */
function code(source: string, text: string, refs: readonly string[] = []): Code {
  const start = source.indexOf(text);
  if (start < 0) throw new Error(`The source doesn't hold ${text}.`);
  return {
    code: text,
    span: { start, end: start + text.length },
    refs: refs.map((name) => reference(source, name, start)),
  };
}

function reference(source: string, name: string, from = 0): CodeReference {
  const start = source.indexOf(name, from);
  return {
    kind: "Binding",
    binding: `${name}@${start}`,
    span: { start, end: start + name.length },
  };
}

/** A module whose IR holds these `Code`s: `anchorOutput` reads them wherever the IR keeps them. */
function moduleOf(file: string, codes: readonly Code[]): UfModule {
  return { irVersion: 1, file, components: [], codes } as unknown as UfModule;
}

/** Where the map says the `index`th `token` of the output came from, as an offset in `source`. */
function originOf(file: OutputFile, map: SourceMapV3, source: string, token: string, index = 0) {
  let at = -1;
  for (let seen = 0; seen <= index; seen++) at = file.contents.indexOf(token, at + 1);
  if (at < 0) throw new Error(`The output doesn't hold ${token}.`);
  const before = file.contents.slice(0, at).split("\n");
  const found = originalPositionFor(new TraceMap(map), {
    line: before.length,
    column: before.at(-1)!.length,
  });
  // The segment must start at the token itself, not somewhere before it on its line.
  const decoded = decodedMappings(new TraceMap(map))[before.length - 1] ?? [];
  if (!decoded.some((segment) => segment[0] === before.at(-1)!.length)) return undefined;
  if (found.line === null) return undefined;
  const lines = source.split("\n").slice(0, found.line - 1);
  return lines.reduce((sum, line) => sum + line.length + 1, 0) + found.column!;
}

/** Each segment's token, in the output and in the source, which L14 reads as one text. */
function mismatches(contents: string, map: SourceMapV3): string[] {
  const output = contents.split("\n");
  const source = map.sourcesContent[0]!.split("\n");
  const problems: string[] = [];
  for (const [line, segments] of decodedMappings(new TraceMap(map)).entries()) {
    for (const segment of segments) {
      if (segment.length !== 4) continue;
      const token = /[\p{ID_Start}$_][\p{ID_Continue}$]*|\d[\w.]*|\S/uy;
      token.lastIndex = segment[3];
      const text = token.exec(source[segment[2]]!)![0];
      if (output[line]!.slice(segment[0], segment[0] + text.length) !== text) {
        problems.push(`${line}:${segment[0]} ${text}`);
      }
    }
  }
  return problems;
}

/** Anchors a file, formats it, and carries the map across, which must hold every text. */
async function anchoredAndFormatted(file: OutputFile, module: UfModule, source: string) {
  const anchored = anchorOutput(file, module, source);
  const formatted = await formatOutput(anchored);
  expect(formatted.error).toBeUndefined();
  const result = remapFormatted(anchored, formatted.file, anchored.map!);
  if (!("map" in result)) throw new Error(result.diagnostic.message);
  expect(mismatches(anchored.contents, anchored.map!)).toEqual([]);
  expect(mismatches(formatted.file.contents, result.map)).toEqual([]);
  return { anchored, after: formatted.file, map: result.map };
}

const SOURCE = [
  "export function Card() {",
  "  const total = price * 2;",
  "  function boom() {",
  '    throw new Error("boom");',
  "  }",
  "  return <p>{total}</p>;",
  "}",
  "",
].join("\n");
const THROW = 'throw new Error("boom");';
const TOTAL = "const total = price * 2;";
const CODES = [code(SOURCE, THROW), code(SOURCE, TOTAL, ["price"])];

describe("anchorOutput and remapFormatted", () => {
  // Each file's code is badly laid out, so formatting moves every position.
  it.each<[string, string, string]>([
    [
      "JS",
      "Card.js",
      `export   function Card(){\n${TOTAL}\nfunction boom(){${THROW}}\nreturn total\n}\n`,
    ],
    [
      "JSX",
      "Card.tsx",
      `export   function Card(){\n${TOTAL}\nfunction boom(){${THROW}}\nreturn <p>{total}</p>\n}\n`,
    ],
    [
      ".vue",
      "Card.vue",
      `<script setup lang="ts">\n${TOTAL}\nfunction boom(){${THROW}}\n</script>\n\n<template>\n  <p>{{ total }}</p>\n</template>\n`,
    ],
    [
      ".svelte",
      "Card.svelte",
      `<script lang="ts">\n${TOTAL}\nfunction boom(){${THROW}}\n</script>\n\n<p>{total}</p>\n`,
    ],
    [".astro", "Card.astro", `---\n${TOTAL}\nfunction boom(){${THROW}}\n---\n\n<p>{total}</p>\n`],
    [
      "an Angular inline template",
      "card.ts",
      `@Component({selector:"uf-card",template: \`<p (click)="boom()">{{ total }}</p>\`})\nexport class Card {\ntotal=0;\nboom(){${THROW}}\ninit(){${TOTAL}}\n}\n`,
    ],
  ])("maps the code of %s through formatting", async (_, path, contents) => {
    const module = moduleOf("src/Card.uf.tsx", CODES);
    const { anchored, after, map } = await anchoredAndFormatted({ path, contents }, module, SOURCE);
    expect(after.contents).not.toBe(contents);
    for (const [file, fileMap] of [
      [anchored, anchored.map!],
      [after, map],
    ] as const) {
      expect(originOf(file, fileMap, SOURCE, "throw")).toBe(SOURCE.indexOf("throw"));
      expect(originOf(file, fileMap, SOURCE, "Error")).toBe(SOURCE.indexOf("Error"));
      expect(originOf(file, fileMap, SOURCE, 'boom"')).toBe(SOURCE.indexOf('boom"'));
      expect(originOf(file, fileMap, SOURCE, "const")).toBe(SOURCE.indexOf("const"));
    }
    expect(map.sources).toEqual(["Card.uf.tsx"]);
    expect(map.sourcesContent).toEqual([SOURCE]);
    expect(map.file).toBe(path);
    expect(map.version).toBe(3);
  });

  it("leaves a Code made only of references unmapped", () => {
    const source = "function f() { return count; }\n";
    const only = code(source, "count", ["count"]);
    const { map } = anchorOutput(
      { path: "f.js", contents: "return count;\n" },
      moduleOf("f.uf.tsx", [only]),
      source,
    );
    expect(map!.mappings.replaceAll(";", "")).toBe("");
    expect(map!.names).toEqual([]);
    expect(map!.sources).toEqual(["f.uf.tsx"]);
  });

  it("names a reference at its start, however the target spells it, right after its run", () => {
    const source = "const a = total + 1;\n";
    const file = anchorOutput(
      { path: "a.js", contents: "const a = props.total + 1;\n" },
      moduleOf("a.uf.tsx", [code(source, source.trim(), ["total"])]),
      source,
    );
    expect(file.map!.names).toEqual(["total"]);
    expect(originOf(file, file.map!, source, "props")).toBe(source.indexOf("total"));
    expect(originOf(file, file.map!, source, "+")).toBe(source.indexOf("+"));
  });

  it("finds a reference that starts its Code only where it keeps its spelling", () => {
    const source = "total + 1;\n";
    const module = moduleOf("a.uf.tsx", [code(source, "total + 1", ["total"])]);
    const kept = anchorOutput({ path: "a.js", contents: "x(total + 1);\n" }, module, source);
    expect(originOf(kept, kept.map!, source, "total")).toBe(0);
    expect(kept.map!.names).toEqual(["total"]);
    const respelled = anchorOutput({ path: "a.js", contents: "x(total() + 1);\n" }, module, source);
    expect(respelled.map!.names).toEqual([]);
    expect(originOf(respelled, respelled.map!, source, "+")).toBe(source.indexOf("+"));
  });

  it("matches the longest run first, so a short one can't take its place", () => {
    const source = "go(1);\ngo(1).then(done);\n";
    const short = code(source, "go(1)");
    const long = code(source, "go(1).then(done)");
    const contents = "go(1).then(done);\ngo(1);\n";
    const file = anchorOutput(
      { path: "a.js", contents },
      moduleOf("a.uf.tsx", [short, long]),
      source,
    );
    expect(originOf(file, file.map!, source, "then")).toBe(source.indexOf("then"));
    expect(originOf(file, file.map!, source, "go")).toBe(source.indexOf("go(1).then"));
    expect(originOf(file, file.map!, source, "go", 1)).toBe(0);
  });

  it("resolves identical runs in source order, never overlapping", () => {
    const source = "fire(1);\nfire(2);\nfire(1);\n";
    const first = { code: "fire(1)", span: { start: 0, end: 7 }, refs: [] };
    const last = { code: "fire(1)", span: { start: 18, end: 25 }, refs: [] };
    const contents = "fire(1);\nfire(1);\n";
    const file = anchorOutput(
      { path: "a.js", contents },
      moduleOf("a.uf.tsx", [last, first]),
      source,
    );
    expect(originOf(file, file.map!, source, "fire")).toBe(0);
    expect(originOf(file, file.map!, source, "fire", 1)).toBe(18);
  });

  it("keeps a shorter run behind the longer run before it in its Code", () => {
    const source = "longlong(x) + b;\n";
    const contents = "x) + b;\nlonglong(props.x) + b;\n";
    const file = anchorOutput(
      { path: "a.js", contents },
      moduleOf("a.uf.tsx", [code(source, "longlong(x) + b", ["x"])]),
      source,
    );
    expect(originOf(file, file.map!, source, "b;")).toBeUndefined();
    expect(originOf(file, file.map!, source, "b;", 1)).toBe(source.indexOf("b;"));
  });

  it("keeps a shorter run in front of the longer run after it in its Code", () => {
    const source = "b(x) + longlong(y);\n";
    const contents = "props.x) + longlong(props.y);\nb(x);\n";
    const file = anchorOutput(
      { path: "a.js", contents },
      moduleOf("a.uf.tsx", [code(source, "b(x) + longlong(y)", ["x", "y"])]),
      source,
    );
    expect(originOf(file, file.map!, source, "longlong")).toBe(source.indexOf("longlong"));
    expect(originOf(file, file.map!, source, "b(")).toBeUndefined();
  });

  it("maps text once, however many Codes hold it", () => {
    const source = "a = go(1);\n";
    const file = anchorOutput(
      { path: "a.js", contents: "a = go(1);\ngo(1);\n" },
      moduleOf("a.uf.tsx", [code(source, "a = go(1)"), code(source, "go(1)")]),
      source,
    );
    expect(originOf(file, file.map!, source, "go")).toBe(source.indexOf("go"));
    expect(originOf(file, file.map!, source, "go", 1)).toBeUndefined();
  });

  it("finds a run beside a reference only where the output spells it", () => {
    const source = "shelves.map(count);\nbooks.map(count);\n";
    const shelves = code(source, "shelves.map(count)", ["shelves", "count"]);
    const contents = "books.map(count);\nprops.shelves.map(count);\n";
    const file = anchorOutput({ path: "a.js", contents }, moduleOf("a.uf.tsx", [shelves]), source);
    expect(originOf(file, file.map!, source, ".map")).toBeUndefined();
    expect(originOf(file, file.map!, source, ".map", 1)).toBe(source.indexOf(".map"));
    const dropped = anchorOutput(
      { path: "a.js", contents: "books.map(other);\n" },
      moduleOf("a.uf.tsx", [shelves]),
      source,
    );
    expect(dropped.map!.mappings.replaceAll(";", "")).toBe("");
  });

  it("names nothing but the reference's spelling", () => {
    const source = "go(total);\n";
    const module = moduleOf("a.uf.tsx", [code(source, "go(total", ["total"])]);
    const file = anchorOutput({ path: "a.js", contents: "go(other);\n" }, module, source);
    expect(file.map!.names).toEqual([]);
    expect(file.map!.mappings.replaceAll(";", "")).toBe("");
  });

  it("names nothing at the end of a file, where a target dropped the reference", () => {
    const source = "go(total";
    const file = anchorOutput(
      { path: "a.js", contents: "go(" },
      moduleOf("a.uf.tsx", [
        { code: source, span: { start: 0, end: 8 }, refs: [reference(source, "total")] },
      ]),
      source,
    );
    expect(file.map!.names).toEqual([]);
    expect(decodedMappings(new TraceMap(file.map!)).flat()).toHaveLength(0);
  });

  it("leaves a short run nothing checks unmapped, where the output holds other places", () => {
    const source = "type A = void;\n";
    const module = moduleOf("a.uf.tsx", [code(source, "void")]);
    const two = anchorOutput({ path: "a.js", contents: "x: void; y: void;\n" }, module, source);
    expect(two.map!.mappings.replaceAll(";", "")).toBe("");
    const one = anchorOutput({ path: "a.js", contents: "x: void;\n" }, module, source);
    expect(originOf(one, one.map!, source, "void")).toBe(source.indexOf("void"));
    const none = anchorOutput({ path: "a.js", contents: "x: never;\n" }, module, source);
    expect(none.map!.mappings.replaceAll(";", "")).toBe("");
  });

  it("takes a distinctive run nothing checks at its first place", () => {
    const source = "throwAway();\n";
    const file = anchorOutput(
      { path: "a.js", contents: "throwAway();\nthrowAway();\n" },
      moduleOf("a.uf.tsx", [code(source, "throwAway()")]),
      source,
    );
    expect(originOf(file, file.map!, source, "throwAway")).toBe(0);
    expect(originOf(file, file.map!, source, "throwAway", 1)).toBeUndefined();
  });

  it("matches whole tokens only", () => {
    const source = "data + a;\n";
    const module = moduleOf("a.uf.tsx", [code(source, "a", [])]);
    const file = anchorOutput({ path: "a.js", contents: "data;\na;\n" }, module, source);
    expect(originOf(file, file.map!, source, "a;", 1)).toBeDefined();
    expect(originOf(file, file.map!, source, "data")).toBeUndefined();
  });

  it("leaves punctuation alone, which would match anywhere", () => {
    const source = "go();\n";
    const parts = { code: "();", span: { start: 2, end: 5 }, refs: [] };
    const file = anchorOutput(
      { path: "a.js", contents: "other();\n" },
      moduleOf("a.uf.tsx", [parts]),
      source,
    );
    expect(file.map!.mappings.replaceAll(";", "")).toBe("");
  });

  it("finds each line of a Code a printer re-indents", () => {
    const source = "if (a) {\n  go();\n}\n";
    const file = anchorOutput(
      { path: "a.svelte", contents: "    if (a) {\n      go();\n    }\n" },
      moduleOf("a.uf.tsx", [code(source, "if (a) {\n  go();\n}")]),
      source,
    );
    expect(originOf(file, file.map!, source, "go")).toBe(source.indexOf("go"));
    expect(originOf(file, file.map!, source, "if")).toBe(0);
  });

  it("maps a write's value and an emit's arguments, and neither's replaced call", () => {
    const source = 'count.value += step * 2;\nemit("change", count.value + 1);\n';
    const write: Code = {
      code: "count.value += step * 2",
      span: { start: 0, end: 23 },
      refs: [
        {
          kind: "Write",
          binding: "count@0",
          operator: "+=",
          span: { start: 0, end: 23 },
          target: { start: 0, end: 11 },
          value: { start: 15, end: 23 },
        },
        reference(source, "step"),
      ],
    };
    const emitAt = source.indexOf("emit");
    const argument = source.indexOf("count.value + 1");
    const emit: Code = {
      code: 'emit("change", count.value + 1)',
      span: { start: emitAt, end: emitAt + 31 },
      refs: [
        {
          kind: "Emit",
          binding: `emit@${emitAt}`,
          event: "change",
          span: { start: emitAt, end: emitAt + 31 },
          arguments: [{ start: argument, end: argument + 15 }],
        },
        {
          kind: "Binding",
          binding: `count@${argument}`,
          span: { start: argument, end: argument + 11 },
        },
      ],
    };
    const contents = "setCount(count() + step() * 2);\nonChange(count() + 1);\n";
    const file = anchorOutput(
      { path: "a.js", contents },
      moduleOf("a.uf.tsx", [write, emit]),
      source,
    );
    expect(originOf(file, file.map!, source, "*")).toBe(source.indexOf("*"));
    expect(originOf(file, file.map!, source, "+", 1)).toBe(source.lastIndexOf("+"));
    expect(originOf(file, file.map!, source, "setCount")).toBeUndefined();
    expect(originOf(file, file.map!, source, "onChange")).toBeUndefined();
  });

  it("names a write a target keeps as written, by the run after it", () => {
    const source = "count.value += 1; go(2);\n";
    const write: Code = {
      code: source.trim(),
      span: { start: 0, end: source.trim().length },
      refs: [
        {
          kind: "Write",
          binding: "count@0",
          operator: "+=",
          span: { start: 0, end: 16 },
          target: { start: 0, end: 11 },
          value: { start: 15, end: 16 },
        },
      ],
    };
    const module = moduleOf("a.uf.tsx", [write]);
    const kept = anchorOutput({ path: "a.js", contents: `x;\n${source}` }, module, source);
    expect(kept.map!.names).toEqual(["count"]);
    expect(originOf(kept, kept.map!, source, "count")).toBe(0);
    const replaced = anchorOutput(
      { path: "a.js", contents: "setCount(count() + 1); go(2);\n" },
      module,
      source,
    );
    expect(replaced.map!.names).toEqual([]);
    expect(originOf(replaced, replaced.map!, source, "go")).toBe(source.indexOf("go"));
  });

  it("names a write after a run only where the output holds its target's name", () => {
    const source = "go(2); count.value += 1;\n";
    const start = source.indexOf("count");
    const write: Code = {
      code: "go(2); count.value += 1",
      span: { start: 0, end: 23 },
      refs: [
        {
          kind: "Write",
          binding: `count@${start}`,
          operator: "+=",
          span: { start, end: 23 },
          target: { start, end: start + 11 },
          value: { start: 22, end: 23 },
        },
      ],
    };
    const module = moduleOf("a.uf.tsx", [write]);
    const kept = anchorOutput({ path: "a.js", contents: source }, module, source);
    expect(kept.map!.names).toEqual(["count"]);
    expect(originOf(kept, kept.map!, source, "count")).toBe(start);
    const replaced = anchorOutput(
      { path: "a.js", contents: "go(2); setValue(next);\n" },
      module,
      source,
    );
    expect(replaced.map!.names).toEqual([]);
    const dropped = anchorOutput({ path: "a.js", contents: "go(2);" }, module, source);
    expect(dropped.map!.names).toEqual([]);
  });

  it("ignores code of another file, whose span happens to lie in the source", () => {
    const source = "go();\n";
    const other = { code: "stop", span: { start: 0, end: 2 }, refs: [] };
    const file = anchorOutput(
      { path: "a.js", contents: "go();\nstop();\n" },
      moduleOf("a.uf.tsx", [other]),
      source,
    );
    expect(file.map!.mappings.replaceAll(";", "")).toBe("");
  });

  it("never maps a sheet", () => {
    const source = "go();\n";
    const file = anchorOutput(
      { path: "a.uf.tsx.css", contents: "go() {}\n" },
      moduleOf("a.uf.tsx", [code(source, "go()")]),
      source,
    );
    expect(file.map!.mappings.replaceAll(";", "")).toBe("");
    expect(file.map!.sources).toEqual(["a.uf.tsx"]);
  });

  it("names the source relative to a file in a directory", () => {
    const file = anchorOutput({ path: "a/b/c.js", contents: "" }, moduleOf("src/C.uf.tsx", []), "");
    expect(file.map!.sources).toEqual(["../../C.uf.tsx"]);
    expect(file.map!.file).toBe("c.js");
  });

  it("counts columns in UTF-16 code units", async () => {
    const source = 'const a = "😀é"; go(a);\n';
    const contents = 'const   a="😀é"; go(a);\n';
    const parts = [code(source, '"😀é"'), code(source, "go(a)")];
    const { after, map } = await anchoredAndFormatted(
      { path: "a.js", contents },
      moduleOf("a.uf.tsx", parts),
      source,
    );
    expect(originOf(after, map, source, "go")).toBe(source.indexOf("go"));
  });

  it("keeps a string's text where oxfmt rewrites its quotes, and drops the quotes' segments", async () => {
    const source = "const a = 'hello';\n";
    const { anchored, after, map } = await anchoredAndFormatted(
      { path: "a.js", contents: "const a = 'hello'\n" },
      moduleOf("a.uf.tsx", [code(source, "'hello'")]),
      source,
    );
    expect(after.contents).toBe('const a = "hello";\n');
    expect(originOf(anchored, anchored.map!, source, "'")).toBe(source.indexOf("'"));
    expect(originOf(after, map, source, "hello")).toBe(source.indexOf("hello"));
    expect(originOf(after, map, source, '"')).toBeUndefined();
  });

  it("keeps a key's text where oxfmt drops its quotes", async () => {
    const source = "const a = { 'k': 1, 'l': 2 };\n";
    const contents = "const a = { 'k': 1, 'l': 2 };\n";
    const { after, map } = await anchoredAndFormatted(
      { path: "a.js", contents },
      moduleOf("a.uf.tsx", [code(source, source.trim())]),
      source,
    );
    expect(after.contents).toBe("const a = { k: 1, l: 2 };\n");
    expect(originOf(after, map, source, "l")).toBe(source.indexOf("l'"));
  });

  it("drops a number's segment where oxfmt rewrites its form", async () => {
    const source = "const first = 1E3 + go;\nconst second = 2;\nconst third = 3;\n";
    const { after, map } = await anchoredAndFormatted(
      { path: "a.js", contents: source },
      moduleOf("a.uf.tsx", [code(source, source.trim())]),
      source,
    );
    expect(after.contents).toContain("const first = 1e3 + go;");
    expect(originOf(after, map, source, "1e3")).toBeUndefined();
    expect(originOf(after, map, source, "go")).toBe(source.indexOf("go"));
  });

  it("doesn't let a small file's rewritten numbers cost the threshold", async () => {
    const source = "const n = 1E3 + 0XAB + .5 + 1.5;\n";
    const contents = `<script setup lang="ts">\n${source}</script>\n`;
    const { after, map } = await anchoredAndFormatted(
      { path: "a.vue", contents },
      moduleOf("a.uf.tsx", [code(source, source.trim())]),
      source,
    );
    expect(after.contents).toContain("1e3");
    expect(originOf(after, map, source, "const")).toBe(0);
    expect(originOf(after, map, source, "1e3")).toBeUndefined();
  });

  it("doesn't count what formatting adds, so code without semicolons maps", async () => {
    const lines = Array.from({ length: 40 }, (_, index) => `let a${index} = 1`);
    const source = `${lines.join("\n")}\n`;
    const { after, map } = await anchoredAndFormatted(
      { path: "a.js", contents: source },
      moduleOf("a.uf.tsx", [code(source, source.trim())]),
      source,
    );
    expect(after.contents).toContain("let a39 = 1;");
    expect(originOf(after, map, source, "a39")).toBe(source.indexOf("a39"));
  });

  it("doesn't count quotes, so a table of quoted keys maps", async () => {
    const entries = Array.from({ length: 40 }, (_, index) => `'k${index}':'v'`).join(",");
    const source = `const t = {${entries}};\n`;
    const { after, map } = await anchoredAndFormatted(
      { path: "a.js", contents: source },
      moduleOf("a.uf.tsx", [code(source, source.trim())]),
      source,
    );
    expect(originOf(after, map, source, "k39")).toBe(source.indexOf("k39"));
  });

  it("follows every token through random edits of a file", () => {
    let seed = 42;
    const random = (limit: number) => {
      // mulberry32: `Math.imul` keeps every bit, which a float's product would lose.
      seed = (seed + 0x6d2b79f5) | 0;
      let mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
      return ((mixed ^ (mixed >>> 14)) >>> 0) % limit;
    };
    for (let round = 0; round < 10; round++) {
      const tokens = Array.from({ length: 400 }, (_, index) => `w${index}`);
      // A few semicolons the edit drops, and parentheses it adds, in lines it breaks anew.
      const source = `${tokens.map((token) => (random(20) ? `${token} ` : `${token} ; `)).join("")}\n`;
      const contents = `${tokens.map((token) => (random(5) ? `${token} ` : `${token} ()`)).join("\n")}\n`;
      const before = anchorOutput(
        { path: "a.js", contents: source },
        moduleOf("a.uf.tsx", [code(source, source.trim())]),
        source,
      );
      const result = remapFormatted(before, { path: "a.js", contents }, before.map!);
      if (!("map" in result)) throw new Error(result.diagnostic.message);
      expect(mismatches(contents, result.map)).toEqual([]);
      // Each token sits on a line of its own, at its start, and all the source is on one line.
      const segments = decodedMappings(new TraceMap(result.map));
      for (const [index, token] of tokens.entries()) {
        const first = segments[index]![0]!;
        expect(first[0]).toBe(0);
        expect(first[3]).toBe(source.indexOf(`${token} `));
      }
    }
  });

  it("counts the whole file, so a small block in a markup file may lose a few characters", () => {
    const source = "const a = (1);\n";
    const markup = `<template>\n  <p>${"text ".repeat(20)}</p>\n</template>\n`;
    const before = anchorOutput(
      { path: "a.vue", contents: `<script lang="ts">\nconst a = (1);\n</script>\n${markup}` },
      moduleOf("a.uf.tsx", [code(source, "const a = (1);")]),
      source,
    );
    const contents = `<script lang="ts">\nconst a = 1;\n</script>\n${markup}`;
    const result = remapFormatted(before, { path: "a.vue", contents }, before.map!);
    if (!("map" in result)) throw new Error(result.diagnostic.message);
    expect(originOf({ path: "a.vue", contents }, result.map, source, "const")).toBe(0);
    expect(originOf({ path: "a.vue", contents }, result.map, source, "1")).toBe(
      source.indexOf("1"),
    );
  });

  it("drops the segment of a token formatting removes, whatever else reads the same", () => {
    const source = "aa bb aa cc dd ee ff gg hh ii jj kk ll mm nn oo pp qq rr ss tt uu;\n";
    const before = anchorOutput(
      { path: "a.js", contents: source },
      moduleOf("a.uf.tsx", [code(source, source.trim())]),
      source,
    );
    const contents = source.replace("bb aa", "bb");
    const result = remapFormatted(before, { path: "a.js", contents }, before.map!);
    if (!("map" in result)) throw new Error(result.diagnostic.message);
    const segments = decodedMappings(new TraceMap(result.map)).flat();
    expect(segments.every((segment) => segment[0] >= 0)).toBe(true);
    expect(segments.map((segment) => segment[3])).toEqual(
      expect.not.arrayContaining([source.lastIndexOf("aa")]),
    );
    expect(segments).toHaveLength(source.trim().match(/\w+|;/g)!.length - 1);
  });

  it("spends one budget across a file's blocks", () => {
    const block = `const value = ${"x".repeat(60)};\n`;
    const source = "";
    const contents = `<script lang="ts">\n${block}</script>\n<script setup lang="ts">\n${block}</script>\n`;
    const before = anchorOutput({ path: "a.vue", contents }, moduleOf("a.uf.tsx", []), source);
    // Each block alone loses less than the file may, and together they lose more.
    const worn = block.replace("x".repeat(9), "");
    const one = contents.replace(block, worn);
    expect(remapFormatted(before, { path: "a.vue", contents: one }, before.map!)).toHaveProperty(
      "map",
    );
    const both = contents.replaceAll(block, worn);
    expect(remapFormatted(before, { path: "a.vue", contents: both }, before.map!)).toMatchObject({
      diagnostic: { code: "UF9002" },
    });
  });

  it("stops looking once the file can't match, rather than holding every edit of a large one", () => {
    const source = "";
    const contents = `${"a".repeat(20_000)}\n`;
    const before = anchorOutput({ path: "a.js", contents }, moduleOf("a.uf.tsx", []), source);
    const started = performance.now();
    const result = remapFormatted(
      before,
      { path: "a.js", contents: `${"b".repeat(20_000)}\n` },
      before.map!,
    );
    expect(result).toMatchObject({ diagnostic: { code: "UF9002" } });
    // The budget stops it early: without one, it runs to all 40,000 edits and keeps each round.
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it("returns UF9002 instead of a map when fewer than 95% of the characters match", () => {
    const source = "abcdefghijklmnopqrstuvwxyz0123456789;\n";
    const before = anchorOutput(
      { path: "a.js", contents: source },
      moduleOf("src/a.uf.tsx", [code(source, source.trim())]),
      source,
    );
    const nearly = `${source.slice(0, 35)}${source.slice(36)}`;
    expect(remapFormatted(before, { path: "a.js", contents: nearly }, before.map!)).toHaveProperty(
      "map",
    );
    const result = remapFormatted(
      before,
      { path: "a.js", contents: `${source.slice(0, 30)};\n` },
      before.map!,
    );
    expect(result).toMatchObject({ diagnostic: { code: "UF9002", severity: "error" } });
    expect("map" in result).toBe(false);
  });

  it("returns UF9002 when a markup file's code differs too much, or its markup changed", () => {
    const code2 = "const value = 1;\n";
    const contents = `<script lang="ts">\n${code2}</script>\n<p></p>\n`;
    const before = anchorOutput({ path: "a.vue", contents }, moduleOf("a.uf.tsx", []), code2);
    const block = remapFormatted(
      before,
      { path: "a.vue", contents: '<script lang="ts">\nzzz;\n</script>\n<p></p>\n' },
      before.map!,
    );
    expect(block).toMatchObject({ diagnostic: { code: "UF9002" } });
    const markup = remapFormatted(
      before,
      { path: "a.vue", contents: `<script lang="ts">\n${code2}</script>\n<b></b>\n` },
      before.map!,
    );
    expect(markup).toMatchObject({ diagnostic: { code: "UF9002" } });
    const gone = remapFormatted(before, { path: "a.vue", contents: "<p></p>\n" }, before.map!);
    expect(gone).toMatchObject({ diagnostic: { code: "UF9002" } });
    const open = remapFormatted(
      before,
      { path: "a.vue", contents: '<script lang="ts">\n' },
      before.map!,
    );
    expect(open).toMatchObject({ diagnostic: { code: "UF9002" } });
  });

  it("returns the map as it is when formatting changed nothing", () => {
    const before = anchorOutput(
      { path: "a.uf.tsx.css", contents: "a {}\n" },
      moduleOf("a.uf.tsx", []),
      "",
    );
    expect(remapFormatted(before, before, before.map!)).toEqual({ map: before.map });
  });

  it("keeps the markup's positions in a formatted file, past a moved block", async () => {
    const source = "const value = 0;\nrenderLabel(1);\n";
    const contents = `<script setup lang="ts">\nconst   value=0\n</script>\n<template>\n  <p>{{ renderLabel(1) }}</p>\n</template>\n`;
    const { after, map } = await anchoredAndFormatted(
      { path: "a.vue", contents },
      moduleOf("a.uf.tsx", [code(source, "renderLabel(1)")]),
      source,
    );
    expect(after.contents).toContain("const value = 0;");
    expect(originOf(after, map, source, "renderLabel")).toBe(source.indexOf("renderLabel"));
  });
});

describe("identityMapped", () => {
  it("maps each token of a copy onto itself", () => {
    const contents = 'export const a = "x";\n\nexport const b = 1;\n';
    const file = identityMapped({ path: "../shared/a.ts", contents });
    expect(file.contents).toBe(contents);
    expect(file.map!.sources).toEqual(["a.ts"]);
    expect(file.map!.sourcesContent).toEqual([contents]);
    expect(mismatches(contents, file.map!)).toEqual([]);
    expect(originOf(file, file.map!, contents, "b")).toBe(contents.indexOf("b"));
  });
});

describe("oxfmt", () => {
  // ADR-0074: the diff exists because `format()` returns no map. When it starts to, reopen that
  // record: its own map would replace the diff.
  it("returns no map from format()", async () => {
    const result = await format("a.ts", "const a=1", OUTPUT_FORMAT);
    expect(Object.keys(result).toSorted()).toEqual(["code", "errors"]);
    expect(Object.keys(await format("a.ts", "const a=1", { sourceMap: true } as never))).toEqual(
      Object.keys(result),
    );
  });
});
