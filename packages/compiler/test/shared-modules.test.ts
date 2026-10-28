// Shared modules (ADR-0070): the resolver reads a relative `.ts` module and every `.ts` module it
// reaches, and `compile()` copies each into every output tree unchanged, lists it among its
// dependencies, and withholds the component when one imports a framework (UF1204).
import { describe, expect, it } from "vitest";

import { compile, createFileResolver, createSyntacticOracle } from "../src/index.ts";

/**
 * A resolver over in-memory files under `/project`, which counts its reads, and a type oracle over
 * the same files.
 */
function memoryResolver(files: Record<string, string>) {
  const reads: string[] = [];
  const readFile = (path: string) => Promise.resolve(files[path]);
  const resolve = createFileResolver({
    root: "/project",
    readFile: (path) => {
      reads.push(path);
      return readFile(path);
    },
  });
  return { resolve, reads, typeOracle: createSyntacticOracle({ root: "/project", readFile }) };
}

const TOKENS = [
  'import { BASE } from "./base.ts";',
  'import { clamp } from "lodash-es";',
  'export { type Tone } from "../shared/tones";',
  "export const sizes = { sm: BASE, md: BASE * 2 };",
].join("\n");
const BASE = 'import "./base.ts";\nexport const BASE = 4;\n';
const TONES = 'export type Tone = "info" | "danger";\n';

const BADGE = [
  'import { sizes } from "./tokens";',
  'import type { Tone } from "../shared/tones.ts";',
  "export default function Badge({ tone }: { tone: Tone }) {",
  "  return <span class={tone}>{sizes.sm}</span>;",
  "}",
].join("\n");

describe("createFileResolver's `module`", () => {
  it("reads a shared module and each relative `.ts` module it reaches, once", async () => {
    const { resolve, reads } = memoryResolver({
      "/project/src/tokens.ts": TOKENS,
      "/project/src/base.ts": BASE,
      "/project/shared/tones.ts": TONES,
    });
    const module = await resolve.module!({ specifier: "./tokens", importer: "src/Badge.uf.tsx" });
    expect(module).toEqual({
      files: [
        { file: "src/tokens.ts", source: TOKENS },
        { file: "src/base.ts", source: BASE },
        { file: "shared/tones.ts", source: TONES },
      ],
    });
    // `base.ts` imports itself: a module already reached is not read again.
    expect(reads).toEqual([
      "/project/src/tokens.ts",
      "/project/src/base.ts",
      "/project/shared/tones.ts",
    ]);
  });

  it("finds the first framework import and the first unreadable module the module reaches", async () => {
    const { resolve } = memoryResolver({
      "/project/tokens.ts": 'import "./base.ts";\nimport "./gone.ts";\nexport const a = 1;\n',
      "/project/base.ts": 'import { ref } from "vue";\nexport * from "unframework";\n',
    });
    expect(await resolve.module!({ specifier: "./tokens.ts", importer: "A.uf.tsx" })).toMatchObject(
      {
        framework: { specifier: "vue", file: "base.ts" },
        unresolved: { specifier: "./gone.ts", file: "tokens.ts" },
      },
    );
  });

  it.each([
    ["itself", { "/project/tokens.ts": 'export * from "unframework";\n' }, "tokens.ts"],
    [
      "through another module",
      {
        "/project/tokens.ts": 'import { a } from "./base";\nexport const b = a;\n',
        "/project/base.ts": 'import { ref } from "unframework";\nexport const a = ref;\n',
      },
      "base.ts",
    ],
  ])("finds an import of `unframework` the module makes %s (UF1204)", async (_, files, file) => {
    const { resolve } = memoryResolver(files);
    expect(await resolve.module!({ specifier: "./tokens", importer: "A.uf.tsx" })).toMatchObject({
      framework: { specifier: "unframework", file },
    });
  });

  it.each([
    ["`import()`", 'export const load = () => import("react");\n', "react"],
    ["`import … = require()`", 'import R = require("vue");\nexport const r = R;\n', "vue"],
  ])("finds a framework a module loads through %s (UF1204)", async (_, tokens, framework) => {
    const { resolve } = memoryResolver({ "/project/tokens.ts": tokens });
    expect(await resolve.module!({ specifier: "./tokens", importer: "A.uf.tsx" })).toMatchObject({
      framework: { specifier: framework, file: "tokens.ts" },
    });
  });

  it("follows a module a shared module imports with `import()`", async () => {
    const TOKENS_LAZY = 'export const load = () => import("./other");\n';
    const OTHER = "export const other = 1;\n";
    const { resolve } = memoryResolver({
      "/project/tokens.ts": TOKENS_LAZY,
      "/project/other.ts": OTHER,
    });
    expect(await resolve.module!({ specifier: "./tokens", importer: "A.uf.tsx" })).toEqual({
      files: [
        { file: "tokens.ts", source: TOKENS_LAZY },
        { file: "other.ts", source: OTHER },
      ],
    });
  });

  it("follows `import()` of a template without holes, and notes a load it cannot follow", async () => {
    const OTHER = 'import { ref } from "vue";\nexport const r = ref;\n';
    const { resolve } = memoryResolver({
      "/project/tokens.ts": "export const l = () => import(`./other.ts`);\n",
      "/project/other.ts": OTHER,
      "/project/lazy.ts": "export const l = (name: string) => import(name);\n",
      "/project/glob.ts": 'export const all = import.meta.glob("./x/*.ts");\n',
    });
    expect(await resolve.module!({ specifier: "./tokens", importer: "A.uf.tsx" })).toMatchObject({
      framework: { specifier: "vue", file: "other.ts" },
    });
    expect(await resolve.module!({ specifier: "./lazy", importer: "A.uf.tsx" })).toMatchObject({
      unresolved: { specifier: "import(name)", file: "lazy.ts" },
    });
    expect(await resolve.module!({ specifier: "./glob", importer: "A.uf.tsx" })).toMatchObject({
      unresolved: { specifier: "import.meta.glob", file: "glob.ts" },
    });
  });

  it("reads nothing that is missing, not relative or not a `.ts` module", async () => {
    const { resolve, reads } = memoryResolver({ "/project/useX.uf.ts": "" });
    for (const specifier of ["./missing", "pkg", "./useX.uf.ts", "./data.json"]) {
      expect(await resolve.module!({ specifier, importer: "A.uf.tsx" })).toBeUndefined();
    }
    expect(reads).toEqual(["/project/missing.ts"]);
  });
});

describe("compile() with shared modules", () => {
  // A target reads a value import from its composables lane on (ADR-0069): until then, a type
  // import is what reaches a component's output.
  it("copies each module the source reaches beside the outputs, and lists it", async () => {
    const source = [
      'import type { Tone } from "./tokens";',
      "export default function Badge({ tone }: { tone: Tone }) {",
      "  return <span class={tone}>Badge</span>;",
      "}",
    ].join("\n");
    const { resolve, typeOracle } = memoryResolver({
      "/project/src/Badge.uf.tsx": source,
      "/project/src/tokens.ts": TOKENS,
      "/project/src/base.ts": BASE,
      "/project/shared/tones.ts": TONES,
    });
    const result = await compile(source, {
      filename: "src/Badge.uf.tsx",
      targets: ["vue", "react"],
      resolve,
      typeOracle,
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.dependencies).toEqual(["shared/tones.ts", "src/base.ts", "src/tokens.ts"]);
    for (const target of ["vue", "react"]) {
      expect(result.outputs[target]!.slice(1)).toEqual([
        { path: "tokens.ts", contents: TOKENS },
        { path: "base.ts", contents: BASE },
        { path: "../shared/tones.ts", contents: TONES },
      ]);
      expect(Object.keys(result.owners[target]!)).toEqual([result.outputs[target]![0]!.path]);
    }
  });

  it("copies nothing where no component's files were written", async () => {
    const { resolve, typeOracle } = memoryResolver({
      "/project/src/Badge.uf.tsx": BADGE,
      "/project/src/tokens.ts": TOKENS,
      "/project/src/base.ts": BASE,
      "/project/shared/tones.ts": TONES,
    });
    const result = await compile(BADGE, {
      filename: "src/Badge.uf.tsx",
      targets: ["vue"],
      resolve,
      typeOracle,
    });
    expect(result.ir!.moduleImports).toEqual([
      expect.objectContaining({ specifier: "./tokens", file: "tokens.ts" }),
    ]);
    // Vue's composables lane reads the import binding: until it lands, the target reports it.
    expect(result.diagnostics.map(({ code, target }) => [code, target])).toEqual([
      ["UF1002", "vue"],
    ]);
    expect(result.outputs.vue).toEqual([]);
  });

  it("withholds the component from every target when a module imports a framework (UF1204)", async () => {
    const { resolve, typeOracle } = memoryResolver({
      "/project/src/Badge.uf.tsx": BADGE,
      "/project/src/tokens.ts": TOKENS,
      "/project/src/base.ts": 'import { ref } from "react";\nexport const BASE = 4;\n',
      "/project/shared/tones.ts": TONES,
    });
    const result = await compile(BADGE, {
      filename: "src/Badge.uf.tsx",
      targets: ["vue", "react"],
      resolve,
      typeOracle,
    });
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["UF1204"]);
    expect(result.diagnostics[0]!.message).toBe(
      '"./tokens" reaches "base.ts", which imports "react": a shared module is copied unchanged into every framework\'s output, so it imports no framework, and no `unframework`.',
    );
    expect(result.ir).toBeUndefined();
    expect(result.outputs).toEqual({ vue: [], react: [] });
    expect(result.dependencies).toContain("src/base.ts");
  });

  it("reports a value import without a resolver, or one that finds nothing (UF1202)", async () => {
    for (const resolve of [undefined, memoryResolver({}).resolve]) {
      const result = await compile(BADGE.replace("../shared/tones.ts", "pkg"), {
        filename: "src/Badge.uf.tsx",
        targets: ["vue"],
        ...(resolve ? { resolve } : {}),
      });
      expect(result.diagnostics.map(({ code }) => code)).toContain("UF1202");
      expect(result.outputs.vue).toEqual([]);
    }
  });

  it("reports a resolver whose `module` throws (UF9001)", async () => {
    const resolve = Object.assign(() => Promise.resolve(undefined), {
      module: () => Promise.reject(new Error("The disk is gone.")),
    });
    const result = await compile(BADGE, { filename: "Badge.uf.tsx", targets: ["vue"], resolve });
    expect(result.diagnostics.find(({ message }) => message.includes('"./tokens"'))).toMatchObject({
      code: "UF9001",
      message: 'The resolver failed on "./tokens": The disk is gone.',
    });
    expect(result.outputs.vue).toEqual([]);
  });

  // Angular names a component's file in kebab-case: `Badge` writes `badge.ts`.
  // An output imports a component's file by its name without the extension, and Angular names
  // it in kebab-case: a copy at that name would be what the import loads.
  it.each([
    [
      "the component itself, on Angular",
      {
        "/project/src/Badge.uf.tsx": [
          'import type { Tone } from "./badge.ts";',
          "export default function Badge({ tone }: { tone: Tone }) {",
          "  return <span class={tone}>Badge</span>;",
          "}",
        ].join("\n"),
        "/project/src/badge.ts": TONES,
      },
      "src/Badge.uf.tsx",
      "The shared module badge.ts is named like Badge's output file, which an output imports without its extension (`Badge`, and `badge` on Angular): each output tree holds the module's copy beside the components.",
    ],
    [
      "another component of the module, by another extension",
      {
        "/project/Card.uf.tsx": [
          'import type { Tone } from "./CardIcon.ts";',
          "function CardIcon({ tone }: { tone: Tone }) {",
          "  return <i class={tone} />;",
          "}",
          "export default function Card() {",
          '  return <div><CardIcon tone="info" /></div>;',
          "}",
        ].join("\n"),
        "/project/CardIcon.ts": TONES,
      },
      "Card.uf.tsx",
      "The shared module CardIcon.ts is named like CardIcon's output file, which an output imports without its extension (`CardIcon`, and `card-icon` on Angular): each output tree holds the module's copy beside the components.",
    ],
    [
      "a component, in kebab-case as Angular names it",
      {
        "/project/Card.uf.tsx": [
          'import type { Tone } from "./card-icon.ts";',
          "function CardIcon({ tone }: { tone: Tone }) {",
          "  return <i class={tone} />;",
          "}",
          "export default function Card() {",
          '  return <div><CardIcon tone="info" /></div>;',
          "}",
        ].join("\n"),
        "/project/card-icon.ts": TONES,
      },
      "Card.uf.tsx",
      "The shared module card-icon.ts is named like CardIcon's output file, which an output imports without its extension (`CardIcon`, and `card-icon` on Angular): each output tree holds the module's copy beside the components.",
    ],
    [
      "an imported child",
      {
        "/project/Panel.uf.tsx": [
          'import Badge from "./Badge.uf.tsx";',
          'import type { Tone } from "./Badge.ts";',
          "export default function Panel({ tone }: { tone: Tone }) {",
          "  return <div class={tone}><Badge /></div>;",
          "}",
        ].join("\n"),
        "/project/Badge.uf.tsx":
          "export default function Badge() {\n  return <span>Badge</span>;\n}\n",
        "/project/Badge.ts": TONES,
      },
      "Panel.uf.tsx",
      "The shared module Badge.ts is named like Badge's output file, which an output imports without its extension (`Badge`, and `badge` on Angular): each output tree holds the module's copy beside the components.",
    ],
  ])(
    "reports a shared module named like %s (UF1104), for every target",
    async (_, files, filename, message) => {
      const { resolve, typeOracle } = memoryResolver(files);
      const source = files[`/project/${filename}` as keyof typeof files];
      const result = await compile(source, {
        filename,
        targets: ["vue", "react", "angular"],
        resolve,
        typeOracle,
      });
      expect(
        result.diagnostics.map(({ code, target, message: text }) => [code, target, text]),
      ).toEqual([["UF1104", undefined, message]]);
      expect(result.ir).toBeUndefined();
      expect(result.outputs).toEqual({ vue: [], react: [], angular: [] });
    },
  );

  it("accepts a shared module beside a component of another name", async () => {
    const source = [
      'import type { Tone } from "./badge-tones.ts";',
      "export default function Badge({ tone }: { tone: Tone }) {",
      "  return <span class={tone}>Badge</span>;",
      "}",
    ].join("\n");
    const { resolve, typeOracle } = memoryResolver({
      "/project/Badge.uf.tsx": source,
      "/project/badge-tones.ts": TONES,
    });
    const result = await compile(source, {
      filename: "Badge.uf.tsx",
      targets: ["react", "angular"],
      resolve,
      typeOracle,
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.outputs.angular!.map(({ path }) => path)).toEqual(["badge.ts", "badge-tones.ts"]);
  });
});
