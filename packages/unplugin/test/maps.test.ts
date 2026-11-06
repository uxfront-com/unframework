// What `load` returns for a module's map (ADR-0074, ADR-0075). `node:module`'s `SourceMap` reads
// them, so a test needs no map library of its own.
import { SourceMap } from "node:module";
import type { SourceMapPayload } from "node:module";

import type * as Compiler from "@unframework/compiler";
import { TARGET_NAMES } from "@unframework/compiler";
import { createDiagnostic } from "@unframework/diagnostics";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ID_SUFFIXES } from "../src/index.ts";
import unframework from "../src/vite.ts";
import { createProject, startServer } from "./fixtures.ts";
import type { Project } from "./fixtures.ts";

const stub = vi.hoisted(() => ({ dropMaps: false }));

// A stub: a compile that gives its outputs no map, with a warning that isn't an error.
vi.mock("@unframework/compiler", async (importActual) => {
  const actual = await importActual<typeof Compiler>();
  return {
    ...actual,
    createProject: (options: Parameters<typeof actual.createProject>[0]) => {
      const created = actual.createProject(options);
      return {
        ...created,
        compile: async (file: string) => {
          const result = await created.compile(file);
          if (!stub.dropMaps) return result;
          return {
            ...result,
            outputs: Object.fromEntries(
              Object.entries(result.outputs).map(([target, files]) => [
                target,
                files.map(({ path, contents }) => ({ path, contents })),
              ]),
            ),
            diagnostics: [
              ...result.diagnostics,
              createDiagnostic("UF4001", {
                file,
                span: { start: 0, end: 0 },
                severity: "warning",
                message: "This output goes without a map.",
              }),
            ],
          };
        },
      };
    },
  };
});

const SHOUT = [
  'import { computed } from "unframework";',
  "",
  "export default function Shout({ name }: { name: string }) {",
  '  const loud = computed(() => name.toUpperCase().concat("!"));',
  "  return <p>{loud.value}</p>;",
  "}",
  "",
].join("\n");

const TWO = [
  'import { computed } from "unframework";',
  "",
  "export default function Up({ name }: { name: string }) {",
  "  const up = computed(() => name.toUpperCase());",
  "  return <p>{up.value}</p>;",
  "}",
  "",
  "export function Down({ name }: { name: string }) {",
  "  const down = computed(() => name.toLowerCase());",
  "  return <p>{down.value}</p>;",
  "}",
  "",
].join("\n");

const USE_LOUD = [
  'import { computed } from "unframework";',
  "",
  "export function useLoud(name: string) {",
  "  const loud = computed(() => name.toUpperCase());",
  "  return { loud };",
  "}",
  "",
].join("\n");

let project: Project;
beforeAll(() => {
  project = createProject({
    "src/Shout.uf.tsx": SHOUT,
    "src/Two.uf.tsx": TWO,
    "src/useLoud.uf.ts": USE_LOUD,
  });
});
afterAll(() => project.remove());
afterEach(() => {
  stub.dropMaps = false;
});

interface Loaded {
  code: string;
  map?: SourceMapPayload;
}

/** Where a map says the first `text` in the code comes from: its source, and 1-based line. */
function origin({ code, map }: Loaded, text: string) {
  const at = code.indexOf(text);
  expect(at, `${text} in ${code}`).toBeGreaterThanOrEqual(0);
  const before = code.slice(0, at).split("\n");
  const line = before.length - 1;
  const entry = new SourceMap(map!).findEntry(line, before.at(-1)!.length);
  // `findEntry` gives the nearest entry, which may sit on an earlier line: none, here.
  expect("generatedLine" in entry && entry.generatedLine, text).toBe(line);
  return "originalSource" in entry
    ? { source: entry.originalSource, line: entry.originalLine + 1 }
    : undefined;
}

describe("a loaded module's map", () => {
  it.each(TARGET_NAMES)("traces %s's code to its .uf.tsx line", async (target) => {
    const server = await startServer(project.root, unframework({ target }));
    try {
      const id = `${project.root}/src/Shout.uf.tsx${ID_SUFFIXES[target]}`;
      const loaded = (await server.client.pluginContainer.load(id)) as Loaded;
      expect(origin(loaded, ".toUpperCase()")).toEqual({ source: "Shout.uf.tsx", line: 4 });
      expect(loaded.map!.sourcesContent).toEqual([SHOUT]);
    } finally {
      await server.close();
    }
  });

  it("traces every component of a joined module to its own line", async () => {
    const server = await startServer(project.root, unframework({ target: "react" }));
    try {
      const id = `${project.root}/src/Two.uf.tsx`;
      const loaded = (await server.client.pluginContainer.load(id)) as Loaded;
      expect(loaded.map!.sources).toEqual(["Two.uf.tsx"]);
      expect(origin(loaded, ".toUpperCase()")).toEqual({ source: "Two.uf.tsx", line: 4 });
      expect(origin(loaded, ".toLowerCase()")).toEqual({ source: "Two.uf.tsx", line: 9 });
    } finally {
      await server.close();
    }
  });

  it("traces a component that loads under its own id", async () => {
    const server = await startServer(project.root, unframework({ target: "svelte" }));
    try {
      const id = `${project.root}/src/Two.uf.tsx.Down.svelte`;
      const loaded = (await server.client.pluginContainer.load(id)) as Loaded;
      expect(origin(loaded, ".toLowerCase()")).toEqual({ source: "Two.uf.tsx", line: 9 });
    } finally {
      await server.close();
    }
  });

  it("traces a module of composables to its .uf.ts line", async () => {
    const server = await startServer(project.root, unframework({ target: "vue" }));
    try {
      const id = `${project.root}/src/useLoud.uf.ts`;
      const loaded = (await server.client.pluginContainer.load(id)) as Loaded;
      expect(origin(loaded, ".toUpperCase()")).toEqual({ source: "useLoud.uf.ts", line: 4 });
    } finally {
      await server.close();
    }
  });

  it("reaches the code Vite's own transform leaves", async () => {
    // No React here: Vite's import analysis only has to pass over the imports.
    const external = {
      name: "external",
      resolveId: (source: string) =>
        source.startsWith("react") ? { id: source, external: true } : null,
    };
    const server = await startServer(project.root, [...unframework({ target: "react" }), external]);
    try {
      const id = `${project.root}/src/Shout.uf.tsx`;
      const result = await server.client.transformRequest(id);
      const loaded = { code: result!.code, map: result!.map as SourceMapPayload };
      expect(origin(loaded, ".toUpperCase()")?.line).toBe(4);
    } finally {
      await server.close();
    }
  });
});

describe("an output with no map", () => {
  it.each([
    ["vue", "Shout.uf.tsx.vue"],
    ["react", "Two.uf.tsx"],
    ["react", "useLoud.uf.ts"],
  ] as const)("still loads on %s (%s), and its warning fails nothing", async (target, name) => {
    stub.dropMaps = true;
    const server = await startServer(project.root, unframework({ target }));
    try {
      const id = `${project.root}/src/${name}`;
      const loaded = (await server.client.pluginContainer.load(id)) as Loaded;
      expect(loaded.code).toContain(".to");
      expect(loaded).not.toHaveProperty("map");
      expect(server.warnings).toHaveLength(1);
      expect(server.warnings[0]).toContain("warning[UF4001]");
    } finally {
      await server.close();
    }
  });
});
