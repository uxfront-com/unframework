import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { transformSync } from "@babel/core";
import type { ToolchainContext, ToolchainFile } from "@unframework/codegen";
import type * as SolidWeb from "solid-js/web";
import type { Plugin } from "vite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { goldens, packageDir, toolchainDir } from "./fixtures.ts";

const context: ToolchainContext = { toolchainDir, root: packageDir };
const require = createRequire(import.meta.url);
const scratch = join(packageDir, ".uf-tmp", `toolchain-${randomUUID()}`);
beforeAll(() => mkdirSync(scratch, { recursive: true }));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** Every committed Solid golden; the corpus has at least the two `basics` cases. */
function solidGoldens(): ToolchainFile[] {
  const files = goldens("solid");
  expect(files.map((file) => file.path.split("/").at(-1))).toEqual(
    expect.arrayContaining(["Hello.tsx", "ProfileCard.tsx"]),
  );
  return files;
}

function golden(name: string): ToolchainFile {
  const file = solidGoldens().find((entry) => entry.path.endsWith(`/${name}`));
  if (!file) throw new Error(`No Solid golden named ${name}`);
  return file;
}

/** A file in this package's scratch directory, whose imports resolve from its node_modules. */
function scratchFile(name: string, contents: string): string {
  const path = join(scratch, name);
  writeFileSync(path, contents);
  return path;
}

/** Runs the toolchain's own vite-plugin-solid over a golden, as a dev server would. */
async function transformed(mode: "browser" | "ssr", consumer: "client" | "server") {
  const config = await toolchain.vite(mode, context);
  const plugin = (config.plugins as Plugin[]).find((entry) => entry.name === "solid")!;
  const configResolved = plugin.configResolved as (config: object) => void;
  configResolved({ command: "serve", mode: "test" });
  const transform = plugin.transform as (
    this: object,
    code: string,
    id: string,
  ) => Promise<{ code: string }>;
  const { path, contents } = golden("Hello.tsx");
  return (await transform.call({ environment: { config: { consumer } } }, contents, path)).code;
}

describe("solid toolchain", () => {
  it("names its runtime entries", () => {
    expect(toolchain.name).toBe("solid");
    expect(toolchain.client).toBe("@unframework/target-solid/toolchain/client");
    expect(toolchain.server).toBe("@unframework/target-solid/toolchain/server");
  });

  it("configures Vite with Solid's plugin and the runtime the output imports", async () => {
    const browser = await toolchain.vite("browser", context);
    expect(browser.resolve?.dedupe).toEqual(["solid-js"]);
    expect(browser.optimizeDeps?.include).toEqual(["solid-js", "solid-js/web"]);
    const ssr = await toolchain.vite("ssr", context);
    expect(ssr.resolve?.dedupe).toEqual(["solid-js"]);
    expect(ssr.optimizeDeps).toBeUndefined();
  });

  it("compiles DOM code without Solid's HMR wrapper in the browser", async () => {
    const code = await transformed("browser", "client");
    expect(code).toContain("template(");
    expect(code).not.toMatch(/solid-refresh|\$\$registry/);
  });

  it("compiles hydratable server code for SSR", async () => {
    const code = await transformed("ssr", "server");
    expect(code).toContain("ssrHydrationKey");
    expect(code).not.toContain("template(");
  });
});

/** One file through Solid's compiler. */
async function check(contents: string) {
  const path = join(packageDir, "Fixture.tsx");
  return (await toolchain.frameworkCompile([{ path, contents }], context)).get(path);
}

describe("solid frameworkCompile (L3)", () => {
  // It checks every committed golden output, so its time grows with the corpus.
  it("accepts every committed golden output, with no warning", async () => {
    const files = solidGoldens();
    const results = await toolchain.frameworkCompile(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file.path, { errors: [], warnings: [] }])),
    );
  }, 60_000);

  it("rejects a mismatched closing tag", async () => {
    const broken = golden("Hello.tsx").contents.replace("</p>", "</span>");
    expect(await check(broken)).toEqual({
      errors: [
        {
          message: "Expected corresponding JSX closing tag for <p>.",
          line: 2,
          column: 43,
          code: "MissingClosingTagElement",
        },
      ],
      warnings: [],
    });
  });

  it("reports HTML a browser would parse differently, once per template", async () => {
    const result = await check(
      [
        "export default function Card() {",
        "  return (",
        '    <p class="greeting">',
        "      <div>Hello, world!</div>",
        "    </p>",
        "  );",
        "}",
        "",
      ].join("\n"),
    );
    expect(result).toEqual({
      errors: [],
      warnings: [
        {
          message: [
            "The HTML provided is malformed and will yield unexpected output when evaluated by a browser.",
            "User HTML:",
            "<p><div>#text</div></p>",
            "Browser HTML:",
            "<p></p><div>#text</div><p></p>",
            "Original HTML:",
            "<p><div>Hello, world!</div></p>",
          ].join("\n"),
          code: "solid/malformed-html",
        },
      ],
    });
  });

  it("leaves types to the type check", async () => {
    const result = await check(
      'const count: number = "one";\n\nexport default function Count() {\n  return <p>{count}</p>;\n}\n',
    );
    expect(result).toEqual({ errors: [], warnings: [] });
  });

  it("refuses to check no files", async () => {
    await expect(toolchain.frameworkCompile([], context)).rejects.toThrow(/received no files/);
  });
});

describe("solid typecheck (L4)", () => {
  // It checks every committed golden output, so its time grows with the corpus.
  it("accepts every committed golden output in one run", async () => {
    const files = solidGoldens().map((file) => file.path);
    const results = await toolchain.typecheck(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file, []])),
    );
  }, 60_000);

  it("reports each injected type error against its own file", async () => {
    const goldenFiles = solidGoldens().map((file) => file.path);
    const script = scratchFile(
      "Script.tsx",
      'const count: number = "one";\n\nexport default function Script() {\n  return <p>{count}</p>;\n}\n',
    );
    const template = scratchFile(
      "Template.tsx",
      "export default function Template() {\n  return <p>{greet()}</p>;\n}\n",
    );
    const results = await toolchain.typecheck([...goldenFiles, script, template], context);
    expect(Object.fromEntries(results)).toEqual({
      ...Object.fromEntries(goldenFiles.map((file) => [file, []])),
      [script]: [
        {
          message: "Type 'string' is not assignable to type 'number'.",
          line: 1,
          column: 7,
          code: "TS2322",
        },
      ],
      [template]: [{ message: "Cannot find name 'greet'.", line: 2, column: 14, code: "TS2304" }],
    });
  });

  it("checks JSX against Solid's own types", async () => {
    const unknownProp = scratchFile(
      "UnknownProp.tsx",
      'export default function Field() {\n  return <input type="text" valu="x" />;\n}\n',
    );
    const [diagnostic] = (await toolchain.typecheck([unknownProp], context)).get(unknownProp)!;
    expect(diagnostic).toMatchObject({ line: 2, code: "TS2322" });
    expect(diagnostic?.message).toContain("'valu'");
  });
});

/** Compiles a golden the way the `ssr` project does, and imports it. */
async function compiled(file: ToolchainFile, generate: "ssr" | "dom"): Promise<unknown> {
  const { code } = transformSync(file.contents, {
    filename: file.path,
    babelrc: false,
    configFile: false,
    presets: [
      [require.resolve("babel-preset-solid"), { generate, hydratable: generate === "ssr" }],
      [require.resolve("@babel/preset-typescript"), { isTSX: true, allExtensions: true }],
    ],
  })!;
  const path = scratchFile(`${generate}-${randomUUID()}.js`, code!);
  return ((await import(path)) as { default: unknown }).default;
}

describe("solid renderToString (SSR)", () => {
  it("returns the component's HTML, with Solid's hydration keys", async () => {
    const ProfileCard = await compiled(golden("ProfileCard.tsx"), "ssr");
    const html = await renderToString(ProfileCard, {});
    expect(html.replace(/ data-hk="[^"]*"/g, "")).toBe(
      [
        '<article class="profile" aria-labelledby="profile-name">',
        '<header class="profile-header">',
        `<img src="${golden("ProfileCard.tsx").contents.match(/src="([^"]+)"/)![1]}" alt="Ada's avatar" width="48" height="48">`,
        '<h2 id="profile-name">Ada Lovelace</h2>',
        "</header>",
        "<p>Mathematician &amp; writer<br>of the first published program</p>",
        "<hr>",
        '<label for="profile-note">Note</label>',
        '<input id="profile-note" type="text" name="note" placeholder="Say hello">',
        "</article>",
      ].join(""),
    );
    expect(html).toMatch(/^<article data-hk="[^"]+" /);
  });

  it("rejects what is not a component, naming what it received", async () => {
    await expect(renderToString({ default: () => "" }, {})).rejects.toThrow(
      "Expected a Solid component, received object.",
    );
  });

  it("rejects the undefined that Solid's browser build renders, instead of passing", async () => {
    // What the `ssr` project gets when vite-plugin-solid runs without `ssr: true`: the browser
    // build of solid-js/web, whose renderToStringAsync logs an error and returns undefined.
    const browserBuild = join(dirname(require.resolve("solid-js/package.json")), "web/dist/web.js");
    const { renderToStringAsync } = (await import(browserBuild)) as typeof SolidWeb;
    vi.doMock("solid-js/web", async (original) => ({
      ...(await original<typeof SolidWeb>()),
      renderToStringAsync,
    }));
    vi.resetModules();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const server = await import("../src/toolchain/server.ts");
      const ProfileCard = await compiled(golden("ProfileCard.tsx"), "ssr");
      await expect(server.renderToString(ProfileCard, {})).rejects.toThrow(
        "Solid's server render returned undefined, not HTML: solid-js/web resolved to its browser build.",
      );
      expect(errors).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("not supported in the browser"),
        }),
      );
    } finally {
      errors.mockRestore();
      vi.doUnmock("solid-js/web");
      vi.resetModules();
    }
  });
});
