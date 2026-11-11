import { SourceMap } from "node:module";

import type { OutputFile, SourceMapV3 } from "@unframework.dev/codegen";
import { describe, expect, it } from "vitest";

import { assembleModule, joinModules } from "../src/assemble.ts";

const card = 'export default function Card() {\n  return <section className="card" />;\n}\n';
const badge = 'export function Badge() {\n  return <span className="badge" />;\n}\n';

/** A Qwik component module, as the qwik target emits it. */
const qwik = (name: string, exported: string) =>
  `import { component$ } from "@qwik.dev/core";\n\n${exported} component$(() => {\n  return <p>${name}</p>;\n});\n`;

/** A module with one top-level declaration of each kind, plus `exported`. */
const declarations = (exported: string) =>
  `const { a, b: [c, ...d] = [], ...e } = {};\nfunction h() {}\nclass K {}\ninterface P {}\nenum E {}\n${exported}\n`;

/** The IR exports of a file whose one component, `Card`, is exported under each of `names`. */
const exportsOf = (...names: string[]) => names.map((name) => ({ name, local: "Card" }));

describe("assembleModule", () => {
  const base = {
    target: "react",
    filename: "src/Card.uf.tsx",
    extension: ".tsx",
    exports: exportsOf("default"),
  };

  it("loads the one file with the id's extension", () => {
    const files = [
      { path: "Card.tsx", contents: card },
      { path: "Card.css", contents: ".card {}\n" },
    ];
    expect(assembleModule({ ...base, files })).toEqual({ code: card });
  });

  it("explains a missing file, naming what was emitted", () => {
    expect(
      assembleModule({ ...base, extension: ".js", files: [{ path: "Card.tsx", contents: card }] }),
    ).toEqual({
      error:
        "The react target emitted no .js file for src/Card.uf.tsx (it emitted Card.tsx), so the module has no code. A target's module ids must end in the extension of the file it emits for each component.",
    });
    expect(assembleModule({ ...base, files: [] })).toMatchObject({
      error: expect.stringContaining("(it emitted nothing)"),
    });
  });

  it("joins several script files into one module", () => {
    const files = [
      { path: "Card.tsx", contents: card },
      { path: "Badge.tsx", contents: badge },
    ];
    expect(assembleModule({ ...base, files })).toEqual({ code: `${card}\n${badge}` });
  });

  it("keeps a component's names on a script module", () => {
    const files = [{ path: "Card.tsx", contents: card }];
    const exports = exportsOf("Card", "default");
    expect(assembleModule({ ...base, files, exports })).toEqual({ code: card });
  });

  // The plugin gives a markup id one component's files (ADR-0053): two are a target's bug.
  it("refuses several markup files for one id", () => {
    const files = [
      { path: "Card.vue", contents: "<template><section /></template>\n" },
      { path: "Badge.vue", contents: "<template><span /></template>\n" },
    ];
    expect(
      assembleModule({
        target: "vue",
        filename: "src/Card.uf.tsx",
        extension: ".vue",
        files,
        exports: [
          { name: "default", local: "Card" },
          { name: "Badge", local: "Badge" },
        ],
      }),
    ).toEqual({
      error:
        "src/Card.uf.tsx compiles to 2 vue files for one component (Card.vue, Badge.vue), and a .vue file holds one, so they cannot load as one module.",
    });
  });

  it("refuses a markup main component exported by name", () => {
    const vue = { target: "vue", filename: "src/Card.uf.tsx", extension: ".vue" };
    const files = [{ path: "Card.vue", contents: "<template><section /></template>\n" }];
    expect(assembleModule({ ...vue, files, exports: exportsOf("default") })).toEqual({
      code: files[0]!.contents,
    });
    const refusal =
      "src/Card.uf.tsx exports `Card` by name, and the module of a .vue file has only a default export, so `import { Card }` would find nothing on the vue target. Export the file's main component as the default: `export default function Card() { … }`.";
    // Named only, or as well as the default: either way `import { Card }` would not link.
    expect(assembleModule({ ...vue, files, exports: exportsOf("Card") })).toEqual({
      error: refusal,
    });
    expect(assembleModule({ ...vue, files, exports: exportsOf("Card", "default") })).toEqual({
      error: refusal,
    });
    // An alias names the export, and the fix names the function.
    expect(assembleModule({ ...vue, files, exports: exportsOf("Panel") })).toMatchObject({
      error: expect.stringContaining(
        "exports `Panel` by name, and the module of a .vue file has only a default export, so `import { Panel }` would find nothing on the vue target. Export the file's main component as the default: `export default function Card() { … }`.",
      ),
    });
  });
});

/** A map of each of `file`'s lines to the same line of `source`, as `compile()` gives. */
const mapOf = (file: string, source: string, lines: number): SourceMapV3 => ({
  version: 3,
  file,
  sources: [source],
  sourcesContent: [`the text of ${source}`],
  names: [],
  mappings: ["AAAA", ...Array.from({ length: lines - 1 }, () => "AACA")].join(";"),
});

const mapped = (path: string, contents: string, source: string): OutputFile => ({
  path,
  contents,
  map: mapOf(path, source, contents.split("\n").length - 1),
});

/** A file that imports what another file of its join imports. */
const imported = (name: string) =>
  `import { shared } from "./shared";\nexport const ${name} = 1;\n`;

/** A file whose first line carries a name in its map. */
const named = (path: string, name: string, contents: string): OutputFile => ({
  path,
  contents,
  map: { ...mapOf(path, "X.uf.tsx", 1), names: [name], mappings: "AAAAA" },
});

/** The module `joinModules` makes of `files`, which must have a map. */
function mappedJoin(files: readonly OutputFile[]) {
  const result = joinModules(files, "x");
  if (!("map" in result) || !result.map) throw new Error(`no map: ${JSON.stringify(result)}`);
  return { code: result.code, map: result.map };
}

describe("assembleModule's map", () => {
  const base = { target: "vue", filename: "Card.uf.tsx", extension: ".vue", exports: [] };
  const contents = "<template><section /></template>\n";

  it("loads the file's own map", () => {
    const file = mapped("Card.vue", contents, "Card.uf.tsx");
    expect(assembleModule({ ...base, files: [file] })).toEqual({ code: contents, map: file.map });
  });

  it("loads a file with no map without one", () => {
    const result = assembleModule({ ...base, files: [{ path: "Card.vue", contents }] });
    expect(result).toEqual({ code: contents });
    expect(result).not.toHaveProperty("map");
  });
});

describe("joinModules", () => {
  it("joins a file with no map, whose text stays unmapped, beside one that has it", () => {
    const result = mappedJoin([
      mapped("A.tsx", "export const a = 1;\nexport const b = 2;\n", "X.uf.tsx"),
      { path: "B.tsx", contents: "export const c = 3;\n" },
      mapped("D.tsx", "export const d = 4;\n", "X.uf.tsx"),
    ]);
    expect(result.code).toBe(
      "export const a = 1;\nexport const b = 2;\n\nexport const c = 3;\n\nexport const d = 4;\n",
    );
    expect(result.map.sources).toEqual(["X.uf.tsx"]);
    expect(result.map.sourcesContent).toEqual(["the text of X.uf.tsx"]);
    const lines = result.map.mappings.split(";");
    expect(lines[0]).not.toBe("");
    expect(lines[1]).not.toBe("");
    // The separator, and the file with no map: nothing here points at a file that isn't there.
    expect(lines.slice(2, 5)).toEqual(["", "", ""]);
    expect(lines[5]).not.toBe("");
    // D's first line is the source's first line.
    const entry = new SourceMap({ sourceRoot: "", ...result.map }).findEntry(5, 0);
    expect(entry).toMatchObject({ originalSource: "X.uf.tsx", originalLine: 0, originalColumn: 0 });
  });

  it("gives files with no map a join with no map", () => {
    const result = joinModules(
      [
        { path: "A.tsx", contents: "export const a = 1;\n" },
        { path: "B.tsx", contents: "export const b = 2;\n" },
      ],
      "x",
    );
    expect(result).toEqual({ code: "export const a = 1;\n\nexport const b = 2;\n" });
    expect(result).not.toHaveProperty("map");
  });

  it("keeps a map valid past an import the join leaves out", () => {
    const result = mappedJoin([
      mapped("A.tsx", imported("a"), "A.uf.tsx"),
      mapped("B.tsx", imported("b"), "B.uf.tsx"),
    ]);
    expect(result.code).toBe(`${imported("a")}\n${imported("b").split("\n").slice(1).join("\n")}`);
    const trace = new SourceMap({ sourceRoot: "", ...result.map });
    expect(trace.findEntry(1, 0)).toMatchObject({ originalSource: "A.uf.tsx", originalLine: 1 });
    // B's second line, now the join's fourth: its first line went with the repeated import.
    expect(trace.findEntry(3, 0)).toMatchObject({ originalSource: "B.uf.tsx", originalLine: 1 });
  });

  it("keeps two files' names apart", () => {
    const result = mappedJoin([
      named("A.tsx", "first", "export const a = 1;\n"),
      named("B.tsx", "second", "export const b = 2;\n"),
    ]);
    const trace = new SourceMap({ sourceRoot: "", ...result.map });
    expect(trace.findEntry(0, 0)).toMatchObject({ name: "first" });
    expect(trace.findEntry(2, 0)).toMatchObject({ name: "second" });
  });

  it("leaves out an import of a file of the join (ADR-0053)", () => {
    const files = [
      { path: "Note.tsx", contents: "export function Note() {\n  return <p />;\n}\n" },
      {
        path: "Form.tsx",
        contents:
          'import { Note } from "./Note";\n\nexport default function Form() {\n  return <Note />;\n}\n',
      },
    ];
    expect(joinModules(files, "Form.uf.tsx", ["Note.tsx", "Form.tsx"])).toEqual({
      code: "export function Note() {\n  return <p />;\n}\n\n\nexport default function Form() {\n  return <Note />;\n}\n",
    });
  });

  it("writes an import that an earlier file already made once", () => {
    const result = joinModules(
      [
        { path: "Card.tsx", contents: qwik("Card", "export default") },
        { path: "Badge.tsx", contents: qwik("Badge", "export const Badge =") },
      ],
      "x",
    );
    if (!("code" in result)) throw new Error(result.error);
    expect(result.code.match(/import \{ component\$ \}/g)).toHaveLength(1);
    expect(result.code).toContain("export default component$");
    expect(result.code).toContain("export const Badge = component$");
  });

  it("refuses a name that two files bind differently, and names it", () => {
    const result = joinModules(
      [
        { path: "Card.tsx", contents: `import { component$ } from "@qwik.dev/core";\n${card}` },
        {
          path: "Badge.tsx",
          contents: `import { component$, useSignal } from "@qwik.dev/core";\n${badge}`,
        },
      ],
      "src/Card.uf.tsx compiles to 2 qwik files (Card.tsx, Badge.tsx)",
    );
    expect(result).toEqual({
      error:
        "src/Card.uf.tsx compiles to 2 qwik files (Card.tsx, Badge.tsx), and they cannot be joined into one module: `component$` is declared by Card.tsx and Badge.tsx. Give each component its own .uf.tsx file.",
    });
  });

  it("refuses top-level declarations and exports that clash", () => {
    const result = joinModules(
      [
        { path: "One.ts", contents: declarations("export default class One {}") },
        { path: "Two.ts", contents: declarations("export default class Two {}") },
      ],
      "ctx",
    );
    expect("error" in result && result.error).toBe(
      "ctx, and they cannot be joined into one module: `a` is declared by One.ts and Two.ts; `c` is declared by One.ts and Two.ts; `d` is declared by One.ts and Two.ts; `e` is declared by One.ts and Two.ts; `h` is declared by One.ts and Two.ts; `K` is declared by One.ts and Two.ts; `P` is declared by One.ts and Two.ts; `E` is declared by One.ts and Two.ts; `default` is exported by One.ts and Two.ts. Give each component its own .uf.tsx file.",
    );
  });

  it("refuses export names that two files share, however they are written", () => {
    const result = joinModules(
      [
        {
          path: "One.ts",
          contents: 'const one = 1;\nexport { one as shared };\nexport * as ns from "./a";\n',
        },
        {
          path: "Two.ts",
          contents: 'const two = 2;\nexport { two as "shared" };\nexport * as ns from "./b";\n',
        },
      ],
      "ctx",
    );
    expect("error" in result && result.error).toBe(
      "ctx, and they cannot be joined into one module: `shared` is exported by One.ts and Two.ts; `ns` is exported by One.ts and Two.ts. Give each component its own .uf.tsx file.",
    );
  });

  it("refuses a file that does not parse", () => {
    const result = joinModules(
      [
        { path: "Card.tsx", contents: card },
        { path: "Badge.tsx", contents: "export function (" },
      ],
      "ctx",
    );
    expect("error" in result && result.error).toMatch(
      /^ctx, and Badge\.tsx does not parse, so they cannot be joined into one module: /,
    );
  });
});
