import { readFileSync } from "node:fs";

import { CAPABILITY_NAMES, defineTarget } from "@unframework.dev/codegen";
import type { Capabilities } from "@unframework.dev/codegen";
import { describe, expect, it } from "vitest";

import { compile, createProject, TARGET_NAMES } from "../src/index.ts";
import type { CompilerPlugin, TargetName } from "../src/index.ts";

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Decodes `mappings`, by hand, so these tests don't lean on the library that wrote them. */
function decode(mappings: string): number[][][] {
  const state = [0, 0, 0, 0, 0];
  return mappings.split(";").map((line) => {
    state[0] = 0;
    return line
      .split(",")
      .filter(Boolean)
      .map((text) => {
        const fields: number[] = [];
        let value = 0;
        let shift = 0;
        for (const character of text) {
          const digit = BASE64.indexOf(character);
          value += (digit & 31) << shift;
          shift += 5;
          if (digit & 32) continue;
          fields.push(value & 1 ? -(value >> 1) : value >> 1);
          value = 0;
          shift = 0;
        }
        return fields.map((field, index) => (state[index] = state[index]! + field));
      });
  });
}

/** Every mapped token whose text differs between the output and the source. */
function broken(contents: string, map: { mappings: string; sourcesContent: string[] }): string[] {
  const output = contents.split("\n");
  const source = map.sourcesContent[0]!.split("\n");
  const problems: string[] = [];
  for (const [line, segments] of decode(map.mappings).entries()) {
    for (const [column, , fromLine, fromColumn, name] of segments) {
      // A reference's segment carries its name: a target respells it, and only a run stays as written.
      if (name !== undefined) continue;
      const token = /[\p{ID_Start}$_][\p{ID_Continue}$]*|\d[\w.]*|\S/uy;
      token.lastIndex = fromColumn!;
      const text = token.exec(source[fromLine!]!)![0];
      if (output[line]!.slice(column!, column! + text.length) !== text) {
        problems.push(`${line}:${column} ${text}`);
      }
    }
  }
  return problems;
}

/** The source line a token of the output maps to, 1-based, or `undefined`. */
function lineOf(contents: string, mappings: string, token: string): number | undefined {
  const at = contents.indexOf(token);
  if (at < 0) return undefined;
  const before = contents.slice(0, at).split("\n");
  const segment = decode(mappings)[before.length - 1]?.find(
    (candidate) => candidate[0] === before.at(-1)!.length,
  );
  return segment && segment[2]! + 1;
}

/** The source line a position traces to, as a stack frame's lookup finds it: the segment before. */
function tracedLine(mappings: string, line: number, column: number): number | undefined {
  const segments = decode(mappings)[line - 1] ?? [];
  const segment = segments.findLast((candidate) => candidate[0]! <= column);
  return segment && segment[2]! + 1;
}

const SOURCE = `import { computed, ref } from "unframework";

export default function Card({ label, size = 2 }: { label: string; size?: number }) {
  const count = ref(0);
  const doubled = computed(() => count.value * size + 'x'.length);
  function fail(step: number) {
    count.value += step * 3;
    throw new Error('boom ' + label);
  }
  return (
    <button class="card" onClick={() => fail(1)}>
      {label}: {doubled.value + 1000}
    </button>
  );
}
`;

describe("compile with sourceMap", () => {
  it("adds no map without the option", async () => {
    const result = await compile(SOURCE, { filename: "Card.uf.tsx", targets: TARGET_NAMES });
    for (const files of Object.values(result.outputs)) {
      for (const file of files) expect(file).not.toHaveProperty("map");
    }
  });

  it("gives every output a V3 map whose runs are identical to their source", async () => {
    const result = await compile(SOURCE, {
      filename: "src/Card.uf.tsx",
      targets: TARGET_NAMES,
      sourceMap: true,
    });
    expect(result.diagnostics.filter(({ code }) => code.startsWith("UF9"))).toEqual([]);
    for (const [target, files] of Object.entries(result.outputs)) {
      expect(files.length, target).toBeGreaterThan(0);
      for (const file of files) {
        expect(file.map, file.path).toMatchObject({
          version: 3,
          sources: ["Card.uf.tsx"],
          sourcesContent: [SOURCE],
        });
        expect(broken(file.contents, file.map!), `${target} ${file.path}`).toEqual([]);
        expect(decode(file.map!.mappings).flat().length, target).toBeGreaterThan(0);
      }
    }
  });

  it("leaves the outputs' text as it is", async () => {
    const options = { filename: "Card.uf.tsx", targets: TARGET_NAMES };
    const plain = await compile(SOURCE, options);
    const mapped = await compile(SOURCE, { ...options, sourceMap: true });
    for (const target of TARGET_NAMES) {
      expect(mapped.outputs[target]!.map(({ contents }) => contents)).toEqual(
        plain.outputs[target]!.map(({ contents }) => contents),
      );
    }
    expect(mapped.owners).toEqual(plain.owners);
  });

  it("is byte-identical across two compiles (P8)", async () => {
    const options = { filename: "Card.uf.tsx", targets: TARGET_NAMES, sourceMap: true };
    expect(JSON.stringify((await compile(SOURCE, options)).outputs)).toBe(
      JSON.stringify((await compile(SOURCE, options)).outputs),
    );
  });

  it.each(TARGET_NAMES.filter((target) => target !== "astro"))(
    "maps the statement a handler throws from to its line on %s",
    async (target) => {
      const result = await compile(SOURCE, {
        filename: "Card.uf.tsx",
        targets: [target],
        sourceMap: true,
      });
      const file = result.outputs[target]![0]!;
      expect(lineOf(file.contents, file.map!.mappings, "throw")).toBe(8);
      expect(lineOf(file.contents, file.map!.mappings, "Error")).toBe(8);
    },
  );

  it.each(TARGET_NAMES)("maps what the template renders to its line on %s", async (target) => {
    const result = await compile(SOURCE, {
      filename: "Card.uf.tsx",
      targets: [target],
      sourceMap: true,
    });
    const file = result.outputs[target]![0]!;
    expect(lineOf(file.contents, file.map!.mappings, "1000")).toBe(12);
  });

  it.each(TARGET_NAMES.filter((target) => target !== "astro"))(
    "maps a one-line handler's statement on %s",
    async (target) => {
      const source = `export function Tag() {\n  return (\n    <button onClick={() => { throw new Error("boom"); }}>a</button>\n  );\n}\n`;
      const result = await compile(source, {
        filename: "Tag.uf.tsx",
        targets: [target],
        sourceMap: true,
      });
      const file = result.outputs[target]![0]!;
      expect(lineOf(file.contents, file.map!.mappings, "throw")).toBe(3);
    },
  );

  it("maps a string literal's text to its place, once oxfmt rewrites its quotes", async () => {
    const source = `export function Tag() {\n  const name = 'a';\n  return <p>{name}</p>;\n}\n`;
    const result = await compile(source, {
      filename: "Tag.uf.tsx",
      targets: TARGET_NAMES,
      sourceMap: true,
    });
    for (const target of ["react", "vue", "solid", "qwik", "astro", "svelte"]) {
      const file = result.outputs[target]![0]!;
      expect(file.contents, target).toContain('"a"');
      const at = file.contents.indexOf('"a"') + 1;
      const before = file.contents.slice(0, at).split("\n");
      const segment = decode(file.map!.mappings)[before.length - 1]!.find(
        (candidate) => candidate[0] === before.at(-1)!.length,
      );
      expect(segment?.slice(2, 4), target).toEqual([1, source.split("\n")[1]!.indexOf("a'")]);
      expect(broken(file.contents, file.map!), target).toEqual([]);
    }
  });

  it("maps without formatting too", async () => {
    const result = await compile(SOURCE, {
      filename: "Card.uf.tsx",
      targets: ["react"],
      format: false,
      sourceMap: true,
    });
    const file = result.outputs.react![0]!;
    expect(broken(file.contents, file.map!)).toEqual([]);
    expect(lineOf(file.contents, file.map!.mappings, "throw")).toBe(8);
  });

  it("anchors after the output hook", async () => {
    const banner: CompilerPlugin = {
      name: "banner",
      output: (files) =>
        files.map((file) => {
          expect(file).not.toHaveProperty("map");
          return { ...file, contents: `// banner\n${file.contents}` };
        }),
    };
    const result = await compile(SOURCE, {
      filename: "Card.uf.tsx",
      targets: ["react"],
      plugins: [banner],
      sourceMap: true,
    });
    const file = result.outputs.react![0]!;
    expect(file.contents.startsWith("// banner\n")).toBe(true);
    expect(lineOf(file.contents, file.map!.mappings, "throw")).toBe(8);
    expect(broken(file.contents, file.map!)).toEqual([]);
  });

  it("doesn't take a map a plugin or a target returns", async () => {
    const stale = {
      version: 3,
      file: "x",
      sources: [],
      sourcesContent: [],
      names: [],
      mappings: "",
    };
    const plugin: CompilerPlugin = {
      name: "stale",
      output: (files) => files.map((file) => ({ ...file, map: stale as never })),
    };
    const result = await compile(SOURCE, {
      filename: "Card.uf.tsx",
      targets: ["react"],
      plugins: [plugin],
    });
    expect(result.outputs.react![0]).not.toHaveProperty("map");
  });

  it("maps each component's file from its own code, when two write one line", async () => {
    const source = [
      "export function First() {",
      '  function fail() { throw new Error("same"); }',
      "  return <button onClick={fail}>a</button>;",
      "}",
      "export function Second() {",
      '  function fail() { throw new Error("same"); }',
      "  return <button onClick={fail}>b</button>;",
      "}",
      "",
    ].join("\n");
    const result = await compile(source, {
      filename: "Two.uf.tsx",
      targets: ["react"],
      sourceMap: true,
    });
    const lines = result.outputs.react!.map((file) =>
      lineOf(file.contents, file.map!.mappings, "throw"),
    );
    expect(lines).toEqual([2, 6]);
  });

  it("leaves a sheet's map empty, since its text isn't this source's", async () => {
    const source = `import "./Card.css";\nexport function Card() {\n  return <p>a</p>;\n}\n`;
    const result = await compile(source, {
      filename: "Card.uf.tsx",
      targets: ["react"],
      sourceMap: true,
      resolve: Object.assign(async () => undefined, {
        stylesheet: async () => ({ file: "Card.css", source: "p { color: red; }\n" }),
      }),
    });
    const sheet = result.outputs.react!.find(({ path }) => path.endsWith(".css"))!;
    expect(sheet.map).toMatchObject({ sources: ["Card.uf.tsx"], names: [] });
    expect(sheet.map!.mappings.replaceAll(";", "")).toBe("");
  });

  it("gives a shared module's copy an identity map", async () => {
    const shared = "export const size = 1;\n";
    const source = `import { size } from "../lib/size.ts";\nexport function Card() {\n  return <p>{size}</p>;\n}\n`;
    const result = await compile(source, {
      filename: "src/Card.uf.tsx",
      targets: ["react"],
      sourceMap: true,
      resolve: Object.assign(async () => undefined, {
        module: async () => ({ files: [{ file: "lib/size.ts", source: shared }] }),
      }),
    });
    expect(result.diagnostics).toEqual([]);
    const copy = result.outputs.react!.find(({ path }) => path.endsWith("size.ts"))!;
    expect(copy.path).toBe("../lib/size.ts");
    expect(copy.contents).toBe(shared);
    expect(copy.map).toMatchObject({ sources: ["size.ts"], sourcesContent: [shared] });
    const segments = decode(copy.map!.mappings).flat();
    expect(segments.length).toBeGreaterThan(0);
    for (const [column, , line, original] of segments) {
      expect([line, original]).toEqual([0, column]);
    }
  });

  it("maps a composable's module", async () => {
    const source = `import { ref } from "unframework";\nexport function useCounter() {\n  const count = ref(0);\n  function fail() {\n    throw new Error("composable");\n  }\n  return { count, fail };\n}\n`;
    const result = await compile(source, {
      filename: "counter.uf.ts",
      targets: ["vue"],
      sourceMap: true,
    });
    const file = result.outputs.vue![0]!;
    expect(file.map).toMatchObject({ sources: ["counter.uf.ts"] });
    expect(lineOf(file.contents, file.map!.mappings, "throw")).toBe(5);
    expect(broken(file.contents, file.map!)).toEqual([]);
  });

  it("maps each composable's file from its own code, when two write one line", async () => {
    const source = [
      'import { ref } from "unframework";',
      "export function useFirst() {",
      "  const count = ref(0);",
      '  function fail() { throw new Error("same"); }',
      "  return { count, fail };",
      "}",
      "export function useSecond() {",
      "  const count = ref(0);",
      '  function fail() { throw new Error("same"); }',
      "  return { count, fail };",
      "}",
      "",
    ].join("\n");
    const result = await compile(source, {
      filename: "pair.uf.ts",
      targets: ["vue"],
      sourceMap: true,
    });
    expect(result.outputs.vue!).toHaveLength(2);
    const lines = result.outputs.vue!.map((file) =>
      lineOf(file.contents, file.map!.mappings, "throw"),
    );
    expect(lines).toEqual([4, 9]);
  });

  it("raises no error on valid source for what oxfmt drops by itself", async () => {
    const sources = [
      "export function Prices() {\n  const rates = [1.50, 2.50, 3.50, 4.50, 5.50, 6.50, 7.50, 8.50];\n  return <p>{rates.length}</p>;\n}\n",
      "export function Copy() {\n  const lines = ['it\\'s', 'don\\'t', 'can\\'t', 'won\\'t', 'isn\\'t', 'I\\'m', 'we\\'re', 'you\\'re'];\n  return <p>{lines.length}</p>;\n}\n",
      "export function Area(props: { w: number; h: number; d: number }) {\n  const area = (props.w * props.h) + (props.w * props.d) + (props.h * props.d);\n  const half = (area / 2) + (area / 4) + (area / 8) + (area / 16);\n  return <p>{half}</p>;\n}\n",
    ];
    for (const source of sources) {
      const result = await compile(source, {
        filename: "C.uf.tsx",
        targets: TARGET_NAMES,
        sourceMap: true,
      });
      expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
      for (const [target, files] of Object.entries(result.outputs)) {
        for (const file of files) {
          expect(file.map, `${target} ${file.path}`).toBeDefined();
          expect(broken(file.contents, file.map!), target).toEqual([]);
        }
      }
    }
  });

  // Each mapped right until its line was split at its braces first, which gave the text to another.
  it.each<[string, TargetName, number, string, number]>([
    ["control-flow/keyed-map/ContributorTable", "solid", 35, ".login", 26],
    ["control-flow/keyed-map/ContributorTable", "astro", 40, ".login", 26],
    ["lifecycle/teardown-order/SearchSession", "angular", 98, ".length", 53],
    ["lifecycle/unmount-timers/AutoRefresh", "react", 52, "setInterval", 25],
    ["state/array-replacement/TaskList", "qwik", 21, "tasks.value", 19],
  ])(
    "traces %s on %s, line %i, to its authored line",
    async (name, target, line, token, authored) => {
      const url = new URL(`../../../tests/integration/cases/${name}.uf.tsx`, import.meta.url);
      const result = await compile(readFileSync(url, "utf8"), {
        filename: `${name}.uf.tsx`,
        targets: [target],
        sourceMap: true,
      });
      const file = result.outputs[target]!.find(({ contents }) =>
        contents.split("\n")[line - 1]?.includes(token),
      )!;
      const column = file.contents.split("\n")[line - 1]!.indexOf(token);
      expect(tracedLine(file.map!.mappings, line, column)).toBe(authored);
    },
  );

  it("reports UF9002, with its file and target, where a target prints what oxfmt rewrites", async () => {
    const wordy = defineTarget({
      name: "wordy",
      framework: { package: "html", range: "*" },
      capabilities: Object.fromEntries(
        CAPABILITY_NAMES.map((name) => [name, { support: "native" }]),
      ) as Capabilities,
      emit: () => [
        {
          path: "a.tsx",
          contents: `export const a = <>${'<p title="don&apos;t" />'.repeat(20)}</>;\n`,
        },
      ],
    });
    const result = await compile(SOURCE, {
      filename: "src/Card.uf.tsx",
      targets: [wordy],
      sourceMap: true,
    });
    expect(
      result.diagnostics
        .filter(({ code }) => code === "UF9002")
        .map(({ file, target, severity }) => [file, target, severity]),
    ).toEqual([["src/Card.uf.tsx", "wordy", "error"]]);
    const file = result.outputs.wordy![0]!;
    expect(file.contents).toContain(`title="don't"`);
    expect(file).not.toHaveProperty("map");
  });

  it("ships a file past the diff's cap without a map, with UF9003 and no error", async () => {
    const table = Array.from({ length: 50_000 }, () => "1.50").join(", ");
    const source = `const TABLE = [${table}];

export function Table() {
  return <p>{TABLE.length}</p>;
}
`;
    const result = await compile(source, {
      filename: "src/Table.uf.tsx",
      targets: ["react"],
      sourceMap: true,
    });
    const { errors, skipped } = {
      errors: result.diagnostics.filter(({ severity }) => severity === "error"),
      skipped: result.diagnostics.filter(({ code }) => code === "UF9003"),
    };
    expect(errors).toEqual([]);
    expect(skipped.map(({ file, target, severity }) => [file, target, severity])).toEqual([
      ["src/Table.uf.tsx", "react", "warning"],
    ]);
    const file = result.outputs.react![0]!;
    expect(file.contents).toContain("1.5, 1.5");
    expect(file).not.toHaveProperty("map");
  }, 120_000);

  it("passes through a project's compile", async () => {
    const project = createProject({
      root: "/p",
      readFile: async (path) => (path === "/p/Card.uf.tsx" ? SOURCE : undefined),
      targets: ["react"],
      sourceMap: true,
    });
    const result = await project.compile("Card.uf.tsx");
    expect(result.outputs.react![0]!.map).toMatchObject({ sources: ["Card.uf.tsx"] });
  });

  it("reports only that a file doesn't parse, when its block has no end", async () => {
    const broke = defineTarget({
      name: "broke",
      framework: { package: "html", range: "*" },
      capabilities: Object.fromEntries(
        CAPABILITY_NAMES.map((name) => [name, { support: "native" }]),
      ) as Capabilities,
      emit: () => [{ path: "a.vue", contents: '<script lang="ts">\nconst a = 1;\n' }],
    });
    const result = await compile(SOURCE, {
      filename: "Card.uf.tsx",
      targets: [broke],
      sourceMap: true,
    });
    expect(
      result.diagnostics.filter(({ code }) => code.startsWith("UF9")).map(({ code }) => code),
    ).toEqual(["UF9001"]);
    expect(result.outputs.broke![0]).toMatchObject({ map: { sources: ["Card.uf.tsx"] } });
  });

  it("keeps the printed file and its map when a file doesn't parse", async () => {
    const broke = defineTarget({
      name: "broke",
      framework: { package: "html", range: "*" },
      capabilities: Object.fromEntries(
        CAPABILITY_NAMES.map((name) => [name, { support: "native" }]),
      ) as Capabilities,
      emit: () => [{ path: "a.ts", contents: "const = ;\n" }],
    });
    const result = await compile(SOURCE, {
      filename: "Card.uf.tsx",
      targets: [broke],
      sourceMap: true,
    });
    expect(result.diagnostics.map(({ code }) => code)).toContain("UF9001");
    expect(result.outputs.broke![0]).toMatchObject({
      contents: "const = ;\n",
      map: { sources: ["Card.uf.tsx"] },
    });
  });
});
