import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import { defineTarget } from "@unframework/codegen";
import type { Capabilities, CapabilityCell } from "@unframework/codegen";
import {
  compile,
  createFileResolver,
  createSyntacticOracle,
  TARGET_NAMES,
} from "@unframework/compiler";
import type { CompilerPlugin } from "@unframework/compiler";
import { isRunnableDevEnvironment, optimizeDeps, resolveConfig } from "vite";
import type { Plugin } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ID_SUFFIXES, SCAN_ID_PREFIX, unframeworkUnplugin } from "../src/index.ts";
import type { CompileEvent } from "../src/index.ts";
import unframework from "../src/vite.ts";
import { apiOf, codeOf, createProject, fakeVue, HELLO, startServer } from "./fixtures.ts";
import type { Project, TestServer } from "./fixtures.ts";

const BAD =
  'import { useState } from "react";\n\nexport default function Bad() {\n  return <p>Bad</p>;\n}\n';
const MULTI =
  'export default function Card() {\n  return <section class="card">Card</section>;\n}\n\nexport function Badge() {\n  return <span class="badge">New</span>;\n}\n';
const NAMED = HELLO.replace("export default function", "export function");
const STYLED =
  'import { css } from "styled-system/css";\n\nexport default function Styled() {\n  return <p class={css()}>Hi</p>;\n}\n';
const CARD =
  'import "./Card.css";\n\nexport default function Card() {\n  return <p class="card">Hi</p>;\n}\n';
const AUTHORED_SHEET = ".card { color: red }\n";

let project: Project;
beforeAll(() => {
  project = createProject({
    "Hello.uf.tsx": HELLO,
    "Bad.uf.tsx": BAD,
    "Multi.uf.tsx": MULTI,
    "Named.uf.tsx": NAMED,
    "Card.uf.tsx": CARD,
    "Card.css": AUTHORED_SHEET,
    "Styled.uf.tsx": STYLED,
    "main.ts": 'import Hello from "./Hello.uf.tsx";\nexport default Hello;\n',
    "sub/Hello.uf.tsx": HELLO.replace("Hello, world!", "Hello, sub!"),
    "sub/main.ts": 'import Hello from "./Hello.uf.tsx";\nexport default Hello;\n',
    // A package whose `exports` entry maps a subpath without the extension to a component.
    "node_modules/@ds/core/package.json": JSON.stringify({
      name: "@ds/core",
      type: "module",
      exports: { "./hello": "./src/Hello.uf.tsx" },
    }),
    "node_modules/@ds/core/src/Hello.uf.tsx": HELLO,
  });
});
afterAll(() => project.remove());

const file = (name: string) => join(project.root, name);
const importer = () => file("main.ts");
const vueId = () => `${file("Hello.uf.tsx")}.vue`;

/** Runs `fn` against a fresh server whose only plugins are `plugins`. */
async function withServer<T>(
  plugins: Parameters<typeof startServer>[1],
  fn: (server: TestServer) => Promise<T>,
): Promise<T> {
  const server = await startServer(project.root, plugins);
  try {
    return await fn(server);
  } finally {
    await server.close();
  }
}

/**
 * Astro's output for `Hello.uf.tsx`: its root takes a consumer's `class` and `style` (ADR-0054),
 * and its styled parents' scope attributes (ADR-0063).
 */
const ASTRO_HELLO = [
  "---",
  "interface Props {",
  "  class?: string;",
  "  style?: Record<string, string | number | undefined>;",
  "}",
  "",
  "const { class: className, style } = Astro.props;",
  "",
  "/** The scope attributes of the styled parents that render this component, for its root. */",
  'function scopeAttributes(props: object): Record<string, ""> {',
  '  const scope: Record<string, ""> = {};',
  '  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";',
  "  return scope;",
  "}",
  "---",
  "",
  "<p",
  '  class:list={["greeting", className]}',
  "  style={style}",
  "  {...scopeAttributes(Astro.props)}",
  ">Hello, world!</p>",
  "",
].join("\n");

describe("unframework()", () => {
  it("returns the pre plugin, with its api, and the post guard plugin", () => {
    const [pre, post, ...rest] = unframework({ target: "vue" });
    expect(rest).toEqual([]);
    expect([pre!.name, pre!.enforce, post!.name, post!.enforce]).toEqual([
      "unframework",
      "pre",
      "unframework:guard",
      "post",
    ]);
    expect(typeof pre!.api.getCompiled).toBe("function");
  });

  it("refuses targets it cannot name ids for, when it is created", () => {
    const custom = defineTarget({ ...htmlTarget(), name: "custom" });
    expect(() => unframework({ target: custom })).toThrow("need an explicit `extension`");
    expect(() => unframework({ target: "vuee" as never })).toThrow('Unknown target "vuee".');
    expect(() => unframework({ target: "vue", extension: "vue" })).toThrow(
      "is not a file extension",
    );
  });

  it("refuses an invalid passThrough prefix when it is created (ADR-0064)", () => {
    for (const prefix of ["", "./", "/abs", "C:x"]) {
      expect(() => unframework({ target: "vue", passThrough: [prefix] })).toThrow(
        `The passThrough prefix ${JSON.stringify(prefix)} is invalid`,
      );
    }
  });

  it("forwards the passThrough prefixes to compile() (ADR-0064)", async () => {
    const compiles = async (passThrough?: readonly string[]) => {
      const events: CompileEvent[] = [];
      const plugins = [
        ...unframework({
          target: "vue",
          onCompile: (event) => void events.push(event),
          ...(passThrough ? { passThrough } : {}),
        }),
        fakeVue,
      ];
      await withServer(plugins, async ({ client }) => {
        await client.transformRequest(`${file("Styled.uf.tsx")}.vue`).catch(() => undefined);
      });
      return events[0]!;
    };
    const passed = await compiles(["styled-system/"]);
    expect(passed.diagnostics).toEqual([]);
    expect(passed.ir?.passThroughImports?.map(({ specifier }) => specifier)).toEqual([
      "styled-system/css",
    ]);
    // By default only `virtual:` passes through.
    expect((await compiles()).diagnostics.map(({ code }) => code)).toContain("UF1002");
  });

  it("refuses bundlers other than Vite until M6", () => {
    expect(() => unframeworkUnplugin.rollup({ target: "vue" })).toThrow(
      "@unframework/unplugin supports Vite only for now; rollup support is planned for M6.",
    );
  });
});

/** The targets whose module is one markup file, which has only a default export. */
const MARKUP_TARGETS: readonly string[] = ["vue", "svelte", "astro"];

describe.each(TARGET_NAMES)("the %s target", (target) => {
  it("resolves an import to its module id and loads compile()'s output", async () => {
    const expected = await compile(HELLO, { filename: "Hello.uf.tsx", targets: [target] });
    await withServer(unframework({ target }), async ({ client }) => {
      const resolved = await client.pluginContainer.resolveId("./Hello.uf.tsx", importer());
      const id = `${file("Hello.uf.tsx")}${ID_SUFFIXES[target]}`;
      expect(resolved?.id).toBe(id);
      const loaded = codeOf(await client.pluginContainer.load(id));
      expect(loaded).toBe(expected.outputs[target]![0]!.contents);
    });
  });

  it("resolves every specifier TypeScript accepts for the file to the same module id", async () => {
    await withServer(unframework({ target }), async ({ client }) => {
      const id = `${file("Hello.uf.tsx")}${ID_SUFFIXES[target]}`;
      for (const specifier of ["./Hello.uf", "./Hello.uf.js", "./Hello.uf.jsx"]) {
        const resolved = await client.pluginContainer.resolveId(specifier, importer());
        expect(resolved?.id, specifier).toBe(id);
      }
    });
  });

  it(
    MARKUP_TARGETS.includes(target)
      ? "refuses a main component exported by name"
      : "loads a component exported by name, keeping its name",
    async () => {
      const expected = await compile(NAMED, { filename: "Named.uf.tsx", targets: [target] });
      await withServer(unframework({ target }), async ({ client }) => {
        const loading = client.pluginContainer.load(
          `${file("Named.uf.tsx")}${ID_SUFFIXES[target]}`,
        );
        if (!MARKUP_TARGETS.includes(target)) {
          const code = codeOf(await loading);
          expect(code).toBe(expected.outputs[target]![0]!.contents);
          expect(code).toMatch(/^export (?:function|const|class) Hello\b/m);
          return;
        }
        await expect(loading).rejects.toThrow(
          `Named.uf.tsx exports \`Hello\` by name, and the module of a .${target} file has only a default export, so \`import { Hello }\` would find nothing on the ${target} target. Export the file's main component as the default`,
        );
      });
    },
  );
});

// Every target's output imports the scoped sheet as `./Card.uf.tsx.css`, never the author's
// `./Card.css` (ADR-0063): the unplugin serves what the target's compile emitted.
describe.each(TARGET_NAMES)("the scoped sheet on the %s target", (target) => {
  const sheet = () => `${file("Card.uf.tsx")}.css`;
  /** The sheet this target's compile emits, through the same file resolver as the plugin's. */
  const scoped = async () => {
    const resolve = createFileResolver({
      root: project.root,
      readFile: (path) => Promise.resolve(readFileSync(path, "utf8")),
    });
    const result = await compile(CARD, { filename: "Card.uf.tsx", targets: [target], resolve });
    const emitted = result.outputs[target]!.find((output) => output.path === "Card.uf.tsx.css");
    return emitted!.contents;
  };

  it("loads from the module id's import, and the author's sheet never does", async () => {
    const expected = await scoped();
    expect(expected).toMatch(/^\.card\[data-uf-[0-9a-f]{8}\] \{ color: red \}\n$/);
    await withServer(unframework({ target }), async ({ client }) => {
      const module = `${file("Card.uf.tsx")}${ID_SUFFIXES[target]}`;
      const resolve = async (source: string, from: string | undefined) =>
        (await client.pluginContainer.resolveId(source, from))?.id;
      // The module itself loads its component alone: the sheet is no part of it.
      expect(codeOf(await client.pluginContainer.load(module))).not.toContain("color: red");
      expect(await resolve("./Card.uf.tsx.css", module)).toBe(sheet());
      // Its id coming back, absolute or as a root-relative URL from the browser.
      expect(await resolve(sheet(), undefined)).toBe(sheet());
      expect(await resolve("/Card.uf.tsx.css", undefined)).toBe(sheet());
      expect(codeOf(await client.pluginContainer.load(sheet()))).toBe(expected);
      // Vite's CSS pipeline takes the id as any stylesheet's: it ends in `.css`, without `\0`.
      const inline = await client.transformRequest(`${sheet()}?inline`);
      expect(inline?.code).toContain(JSON.stringify(expected));
      expect(client.moduleGraph.getModulesByFile(file("Card.css"))).toBeUndefined();
    });
  });

  it(
    target === "vue"
      ? "loads for plugin-vue's <style src> request"
      : target === "qwik"
        ? "loads for the ?inline import of a segment the optimizer splits off"
        : "is left alone where no module of ours imports it",
    async () => {
      const expected = await scoped();
      await withServer(unframework({ target }), async ({ client }) => {
        const module = `${file("Card.uf.tsx")}${ID_SUFFIXES[target]}`;
        const resolve = async (source: string, from: string) =>
          (await client.pluginContainer.resolveId(source, from))?.id;
        if (target === "vue") {
          // plugin-vue resolves `src` from the module, then imports it with its style query.
          const style = "?vue&type=style&index=0&src=true&lang.css";
          expect(await resolve(`./Card.uf.tsx.css${style}`, module)).toBe(`${sheet()}${style}`);
          expect(codeOf(await client.pluginContainer.load(`${sheet()}${style}`))).toBe(expected);
        } else if (target === "qwik") {
          const segment = `${module}_Card_component_useStyles_Jf8mu3bRpe0.js`;
          expect(await resolve("./Card.uf.tsx.css?inline", segment)).toBe(`${sheet()}?inline`);
          expect(codeOf(await client.pluginContainer.load(`${sheet()}?inline`))).toBe(expected);
        }
        // A file that is no module of ours gets no sheet: Vite finds none on disk.
        expect(await resolve("./Card.uf.tsx.css", importer())).toBeUndefined();
      });
    },
  );

  it("fails a sheet id whose file imports no stylesheet", async () => {
    await withServer(unframework({ target }), async ({ client }) => {
      await expect(client.pluginContainer.load(`${file("Hello.uf.tsx")}.css`)).rejects.toThrow(
        `The ${target} target emitted no Hello.uf.tsx.css for Hello.uf.tsx`,
      );
    });
  });
});

describe("resolveId", () => {
  it("resolves through Vite, so aliases reach the file", async () => {
    await withServer(
      [
        ...unframework({ target: "svelte" }),
        { name: "alias", config: () => ({ resolve: { alias: { "~": project.root } } }) },
      ],
      async ({ client }) => {
        const resolved = await client.pluginContainer.resolveId("~/Hello.uf.tsx", importer());
        expect(resolved?.id).toBe(`${file("Hello.uf.tsx")}.svelte`);
      },
    );
  });

  it("maps module ids back from absolute ids and root-relative URLs, keeping queries", async () => {
    await withServer(unframework({ target: "vue" }), async ({ client }) => {
      const id = `${file("Hello.uf.tsx")}.vue`;
      const style = "?vue&type=style&index=0&lang.css";
      const resolve = async (source: string) =>
        (await client.pluginContainer.resolveId(source))?.id;
      expect(await resolve(id)).toBe(id);
      expect(await resolve("/Hello.uf.tsx.vue")).toBe(id);
      expect(await resolve(`/Hello.uf.tsx.vue${style}`)).toBe(`${id}${style}`);
      expect(await resolve("/Missing.uf.tsx.vue")).toBeUndefined();
    });
  });

  it("resolves a relative module id against its importer, never the root", async () => {
    await withServer(unframework({ target: "vue" }), async ({ client }) => {
      const resolve = async (source: string) =>
        (await client.pluginContainer.resolveId(source, file("sub/main.ts")))?.id;
      expect(await resolve("./Hello.uf.tsx.vue")).toBe(`${file("sub/Hello.uf.tsx")}.vue`);
      expect(await resolve("../Hello.uf.tsx.vue?vue&type=style&index=0&lang.css")).toBe(
        `${file("Hello.uf.tsx")}.vue?vue&type=style&index=0&lang.css`,
      );
      expect(await resolve("./Missing.uf.tsx.vue")).toBeUndefined();
    });
  });

  it("answers the watch edge from its own module with the real file", async () => {
    await withServer(unframework({ target: "vue" }), async ({ client }) => {
      const source = file("Hello.uf.tsx");
      const resolved = await client.pluginContainer.resolveId(source, `${source}.vue`);
      expect(resolved?.id).toBe(source);
      // Any other importer gets the module id.
      const other = await client.pluginContainer.resolveId(source, importer());
      expect(other?.id).toBe(`${source}.vue`);
    });
  });

  it("keeps a query of the import on the module id (Astro's ?container) and loads it", async () => {
    await withServer(unframework({ target: "astro" }), async ({ client }) => {
      const resolved = await client.pluginContainer.resolveId(
        "./Hello.uf.tsx?container",
        importer(),
      );
      expect(resolved?.id).toBe(`${file("Hello.uf.tsx")}.astro?container`);
      const code = codeOf(await client.pluginContainer.load(resolved!.id));
      expect(code).toBe(ASTRO_HELLO);
    });
  });

  it("loads a queried module id cold, whatever the process resolved before", async () => {
    await withServer(unframework({ target: "astro" }), async ({ client }) => {
      const id = `${file("Hello.uf.tsx")}.astro?container`;
      expect(codeOf(await client.pluginContainer.load(id))).toBe(ASTRO_HELLO);
      // From a browser that kept the URL across a server restart.
      expect((await client.pluginContainer.resolveId("/Hello.uf.tsx.astro?container"))?.id).toBe(
        id,
      );
    });
  });

  it("leaves Vite's file queries (?raw, ?url) to the authored file", async () => {
    await withServer(unframework({ target: "react" }), async ({ client }) => {
      const resolved = await client.pluginContainer.resolveId("./Hello.uf.tsx?raw", importer());
      expect(resolved?.id).toBe(`${file("Hello.uf.tsx")}?raw`);
      // Vite's asset plugin loads it: the authored source, not the compiled one.
      expect(codeOf(await client.pluginContainer.load(resolved!.id))).toBe(
        `export default ${JSON.stringify(HELLO)}`,
      );
    });
  });

  it("externalises imports during the dependency scan", async () => {
    await withServer(unframework({ target: "angular" }), async ({ client }) => {
      // Vite's dependency scanner passes `scan`, which the public type omits.
      const scanning = { scan: true } as Parameters<typeof client.pluginContainer.resolveId>[2];
      const resolved = await client.pluginContainer.resolveId(
        "./Hello.uf.tsx",
        importer(),
        scanning,
      );
      expect(resolved?.id).toBe(`\0uf-scan:${file("Hello.uf.tsx")}`);
    });
  });
});

describe("an import that never names the file", () => {
  it("fails loudly when the authored file reaches a target whose ids have a suffix", async () => {
    for (const target of TARGET_NAMES.filter((name) => ID_SUFFIXES[name] !== "")) {
      await withServer(unframework({ target }), async ({ client }) => {
        const resolved = await client.pluginContainer.resolveId("@ds/core/hello", importer());
        // Vite resolved the package's `exports` entry itself: the plugin never saw the import.
        const authored = file("node_modules/@ds/core/src/Hello.uf.tsx");
        expect(resolved?.id, target).toBe(authored);
        await expect(client.pluginContainer.load(authored), target).rejects.toThrow(
          `node_modules/@ds/core/src/Hello.uf.tsx reached Vite as itself, which would load it as plain TSX rather than as its ${target} component: the import that resolved to it does not name the file (a package's \`exports\` entry or a tsconfig path, say), so this plugin never saw it. Import it with a specifier that ends in .uf.tsx, such as "./Hello.uf.tsx"; a package that ships .uf.tsx sources must export them under subpaths that do.`,
        );
        // Vite's file queries still mean the authored file.
        expect(await client.pluginContainer.load(`${authored}?raw`), target).not.toBeNull();
      });
    }
  });

  it("compiles it on a target whose module id is the file itself", async () => {
    const expected = await compile(HELLO, { filename: "Hello.uf.tsx", targets: ["react"] });
    await withServer(unframework({ target: "react" }), async ({ client }) => {
      const resolved = await client.pluginContainer.resolveId("@ds/core/hello", importer());
      expect(codeOf(await client.pluginContainer.load(resolved!.id))).toBe(
        expected.outputs.react![0]!.contents,
      );
    });
  });
});

/**
 * A project whose `.uf.tsx` file imports a package that is not installed, as the scan sees it,
 * imported with each specifier that names it.
 */
const scanned = () =>
  createProject({
    "Uses.uf.tsx": `import { ref } from "uf-not-installed";\n${HELLO}`,
    "entry.ts": [
      'import Uses from "./Uses.uf.tsx";',
      'import UsesExtensionless from "./Uses.uf";',
      'import UsesNodeNext from "./Uses.uf.js";',
      "export default [Uses, UsesExtensionless, UsesNodeNext];",
      "",
    ].join("\n"),
  });

/** Runs Vite's dependency scan and pre-bundling over `entry.ts`. */
async function scan(root: string, plugins: ReturnType<typeof unframework>) {
  const config = await resolveConfig(
    {
      root,
      configFile: false,
      logLevel: "silent",
      cacheDir: join(root, ".vite"),
      optimizeDeps: { entries: ["entry.ts"] },
      plugins,
    },
    "serve",
  );
  return optimizeDeps(config, true);
}

describe("the dependency scan", () => {
  it("never reads a .uf.tsx file, so its imports are not dependencies", async () => {
    const scanProject = scanned();
    try {
      const metadata = await scan(scanProject.root, unframework({ target: "vue" }));
      expect(Object.keys(metadata.optimized)).toEqual([]);
    } finally {
      scanProject.remove();
    }
  });

  it("fails without the plugin's scan answer (the control)", async () => {
    const scanProject = scanned();
    try {
      await expect(scan(scanProject.root, [])).rejects.toThrow(/could not be resolved/);
    } finally {
      scanProject.remove();
    }
  });
});

describe("load", () => {
  it("compiles with formatting unless it is turned off", async () => {
    const long = `export default function Long() {\n  return <p>${"word ".repeat(30).trim()}</p>;\n}\n`;
    const longFile = project.write("Long.uf.tsx", long);
    // React's printer writes the paragraph on one line, which oxfmt wraps.
    const raw = await compile(long, { filename: "Long.uf.tsx", targets: ["react"], format: false });
    await withServer(unframework({ target: "react", format: false }), async ({ client }) => {
      const code = codeOf(await client.pluginContainer.load(longFile));
      expect(code).toBe(raw.outputs.react![0]!.contents);
    });
    const formatted = await compile(long, { filename: "Long.uf.tsx", targets: ["react"] });
    expect(formatted.outputs.react![0]!.contents).not.toBe(raw.outputs.react![0]!.contents);
  });

  it.each([
    ["vue", "?vue&type=style&index=0&lang.css"],
    ["svelte", "?svelte&type=style&lang.css"],
    ["astro", "?astro&type=style&index=0&lang.css"],
  ] as const)("leaves %s's sub-requests (%s) to the framework", async (target, query) => {
    await withServer(unframework({ target }), async ({ client }) => {
      const id = `${file("Hello.uf.tsx")}.${target}${query}`;
      expect(await client.pluginContainer.load(id)).toBeNull();
    });
  });

  it("fails a module with errors with the code frame and the UF code, uncoloured", async () => {
    await withServer(unframework({ target: "vue" }), async ({ client }) => {
      const error: unknown = await client.pluginContainer.load(`${file("Bad.uf.tsx")}.vue`).then(
        () => undefined,
        (reason: unknown) => reason,
      );
      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty("plugin", "unframework");
      expect(error).toHaveProperty(
        "message",
        [
          'error[UF1201]: "react" is a React module, and components are framework-free.',
          " --> Bad.uf.tsx:1:26",
          "  |",
          '1 | import { useState } from "react";',
          "  |                          ^^^^^^^",
          "  |",
          '  = help: Write the component with the authoring API from "unframework" (ref, computed, watch and the define* macros); the compiler writes the framework code.',
          "  = see: https://unframework.dev/diagnostics/UF1201",
        ].join("\n"),
      );
    });
  });

  it("reports warnings and info diagnostics with this.warn, and still loads", async () => {
    for (const severity of ["warning", "info"] as const) {
      const target = defineTarget({
        ...htmlTarget(),
        capabilities: { ...htmlTarget().capabilities, element: unsupported(severity) },
      });
      await withServer(
        unframework({ target, extension: ".html" }),
        async ({ client, warnings }) => {
          const code = codeOf(await client.pluginContainer.load(`${file("Hello.uf.tsx")}.html`));
          expect(code).toBe("<p></p>\n");
          expect(warnings).toHaveLength(1);
          expect(warnings[0]).toContain(
            [
              `${severity}[UF4001] (html): The html target does not support element: it is a test target.`,
              " --> Hello.uf.tsx:2:10",
              "  |",
              '2 |   return <p class="greeting">Hello, world!</p>;',
              "  |          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
            ].join("\n"),
          );
        },
      );
    }
  });

  // A suffix of several extensions reads as a component id too (ADR-0053): the module id wins.
  it("loads a module id whose suffix holds several extensions", async () => {
    const expected = await compile(HELLO, { filename: "Hello.uf.tsx", targets: ["vue"] });
    await withServer(
      unframework({ target: "vue", extension: ".client.vue" }),
      async ({ client }) => {
        const id = `${file("Hello.uf.tsx")}.client.vue`;
        expect(codeOf(await client.pluginContainer.load(id))).toBe(
          expected.outputs.vue![0]!.contents,
        );
        expect(await client.pluginContainer.resolveId("./Hello.uf.tsx", importer())).toMatchObject({
          id,
        });
      },
    );
  });

  it("explains a module id whose extension the target never emits", async () => {
    await withServer(unframework({ target: "astro", extension: ".js" }), async ({ client }) => {
      await expect(client.pluginContainer.load(`${file("Hello.uf.tsx")}.js`)).rejects.toThrow(
        "The astro target emitted no .js file for Hello.uf.tsx (it emitted Hello.astro)",
      );
    });
  });

  it("caches a compile until the source changes", async () => {
    let compiles = 0;
    const counter: CompilerPlugin = { name: "counter", ir: () => void compiles++ };
    const counted = project.write("Counted.uf.tsx", HELLO);
    await withServer(unframework({ target: "svelte", plugins: [counter] }), async ({ client }) => {
      const id = `${counted}.svelte`;
      const first = codeOf(await client.pluginContainer.load(id));
      expect(codeOf(await client.pluginContainer.load(id))).toBe(first);
      expect(compiles).toBe(1);
      writeFileSync(counted, HELLO.replace("Hello, world!", "Hello, again!"));
      const second = codeOf(await client.pluginContainer.load(id));
      expect(compiles).toBe(2);
      expect(second).toBe(first.replace("Hello, world!", "Hello, again!"));
    });
  });

  it("passes compiler plugins to compile(), so canaries change what loads", async () => {
    const canary: CompilerPlugin = {
      name: "wrong-text",
      output: (files) =>
        files.map((output) => ({ ...output, contents: output.contents.replace("world", "wrld") })),
    };
    await withServer(unframework({ target: "vue", plugins: [canary] }), async ({ client }) => {
      const code = codeOf(await client.pluginContainer.load(`${file("Hello.uf.tsx")}.vue`));
      expect(code).toContain("Hello, wrld!");
    });
  });
});

describe("files with several components", () => {
  it.each(["react", "solid", "qwik", "angular"] as const)(
    "load as one %s module",
    async (target) => {
      const compiled = await compile(MULTI, { filename: "Multi.uf.tsx", targets: [target] });
      const [card, badge] = compiled.outputs[target]!;
      await withServer(unframework({ target }), async ({ client }) => {
        const code = codeOf(
          await client.pluginContainer.load(`${file("Multi.uf.tsx")}${ID_SUFFIXES[target]}`),
        );
        // Each file's code, with an import the first file already made written once, on one
        // line or on several.
        const imports = card!.contents.match(/^import\b[^;]*;$/gm) ?? [];
        expect(code).toBe(
          `${card!.contents}\n${imports.reduce((rest, line) => rest.replace(`${line}\n`, ""), badge!.contents)}`,
        );
      });
    },
  );

  it("load a markup target's main component under the module id, and each other under its own", async () => {
    const compiled = await compile(MULTI, { filename: "Multi.uf.tsx", targets: ["svelte"] });
    const [card, badge] = compiled.outputs.svelte!;
    await withServer(unframework({ target: "svelte" }), async ({ client }) => {
      const main = `${file("Multi.uf.tsx")}.svelte`;
      expect(codeOf(await client.pluginContainer.load(main))).toBe(card!.contents);
      // A component id (ADR-0053): the file, then the output file of the component.
      const component = `${file("Multi.uf.tsx")}.Badge.svelte`;
      expect(codeOf(await client.pluginContainer.load(component))).toBe(badge!.contents);
      expect(await client.pluginContainer.resolveId(component, main)).toMatchObject({
        id: component,
      });
    });
  });
});

describe("children (ADR-0053)", () => {
  const FIELD =
    'export default function Field({ label }: { label: string }) {\n  return <span class="field">{label}</span>;\n}\n';
  const FORM =
    'import Field from "./Field.uf.tsx";\n\nfunction Note() {\n  return <p>Note</p>;\n}\n\nexport default function Form() {\n  return (\n    <form>\n      <Field label="Name" />\n      <Note />\n    </form>\n  );\n}\n';

  it("compiles a parent with its children's APIs, and resolves its imports of their outputs", async () => {
    const children = createProject({ "Field.uf.tsx": FIELD, "Form.uf.tsx": FORM });
    try {
      const server = await startServer(children.root, unframework({ target: "vue" }));
      try {
        const { client } = server;
        const form = `${join(children.root, "Form.uf.tsx")}.vue`;
        const code = codeOf(await client.pluginContainer.load(form));
        expect(code).toContain('import Field from "./Field.vue";');
        expect(code).toContain('import Note from "./Note.vue";');
        // A child's main component loads under its module id, a local one under a component id.
        expect(await client.pluginContainer.resolveId("./Field.vue", form)).toMatchObject({
          id: `${join(children.root, "Field.uf.tsx")}.vue`,
        });
        expect(await client.pluginContainer.resolveId("./Note.vue", form)).toMatchObject({
          id: `${join(children.root, "Form.uf.tsx")}.Note.vue`,
        });
        expect(await client.pluginContainer.resolveId("./Missing.vue", form)).toBeNull();
      } finally {
        await server.close();
      }
    } finally {
      children.remove();
    }
  });

  it("resolves a child's output from a module a framework splits off the parent's", async () => {
    const children = createProject({ "Field.uf.tsx": FIELD, "Form.uf.tsx": FORM });
    try {
      const server = await startServer(children.root, unframework({ target: "qwik" }));
      try {
        const { client } = server;
        const form = join(children.root, "Form.uf.tsx");
        expect(codeOf(await client.pluginContainer.load(form))).toContain(
          'import Field from "./Field";',
        );
        // Qwik's optimizer moves a component's body, and the imports it reads, into a segment.
        const segment = `${form}_Form_component_Jf8mu3bRpe0.js`;
        expect(await client.pluginContainer.resolveId("./Field", segment)).toMatchObject({
          id: join(children.root, "Field.uf.tsx"),
        });
        // A script target joins a file's outputs: a local child loads under the module id.
        expect(await client.pluginContainer.resolveId("./Note", segment)).toMatchObject({
          id: form,
        });
        // A file that only starts with the module's name is no segment: its imports are its own.
        for (const lookalike of [`${form}_helpers.ts`, `${form}_assets/util.js`]) {
          expect(await client.pluginContainer.resolveId("./Field", lookalike)).toBeNull();
        }
      } finally {
        await server.close();
      }
    } finally {
      children.remove();
    }
  });

  it("recompiles a parent when a child's API changes, and watches the child", async () => {
    const children = createProject({ "Field.uf.tsx": FIELD, "Form.uf.tsx": FORM });
    try {
      const server = await startServer(children.root, [...unframework({ target: "vue" }), fakeVue]);
      try {
        const { client } = server;
        const form = `${join(children.root, "Form.uf.tsx")}.vue`;
        await client.transformRequest(form);
        const module = await client.moduleGraph.getModuleByUrl(form);
        const watched = [...(module?.importedModules ?? [])].map((each) => each.file);
        expect(watched).toContain(join(children.root, "Field.uf.tsx"));
        // A prop the child no longer declares: the cached compile is stale.
        children.write("Field.uf.tsx", FIELD.replaceAll("label", "title"));
        await expect(client.pluginContainer.load(form)).rejects.toThrow("UF3035");
      } finally {
        await server.close();
      }
    } finally {
      children.remove();
    }
  });
});

describe("composables (ADR-0069)", () => {
  const TOGGLE = [
    'import { ref } from "unframework";',
    "export function useToggle(initial: boolean) {",
    "  const on = ref(initial);",
    "  function toggle() {",
    "    on.value = !on.value;",
    "  }",
    "  return { on, toggle };",
    "}",
    "",
  ].join("\n");
  const SWITCH = [
    'import { useToggle } from "./useToggle.uf.ts";',
    "export default function Switch() {",
    "  const { on, toggle } = useToggle(false);",
    "  return <button onClick={() => toggle()}>{on.value ? 'On' : 'Off'}</button>;",
    "}",
    "",
  ].join("\n");
  const files = {
    "useToggle.uf.ts": TOGGLE,
    "Switch.uf.tsx": SWITCH,
    "main.ts": 'import { useToggle } from "./useToggle.uf.ts";\nexport default useToggle;\n',
  };

  /** A third-party target that emits each composable as `<name>.ts`. */
  const scripted = () =>
    defineTarget({
      ...htmlTarget(),
      emitComposable: (composable) => [
        {
          path: `${composable.name}.ts`,
          contents: `export function ${composable.name}() {\n  return {};\n}\n`,
        },
      ],
    });

  it("resolves an import of a `.uf.ts` file to its target's id, and maps the id back", async () => {
    const composables = createProject(files);
    try {
      const server = await startServer(composables.root, unframework({ target: "svelte" }));
      try {
        const { client } = server;
        const main = join(composables.root, "main.ts");
        const id = `${join(composables.root, "useToggle.uf.ts")}.svelte.ts`;
        for (const specifier of ["./useToggle.uf.ts", "./useToggle.uf"]) {
          expect(await client.pluginContainer.resolveId(specifier, main), specifier).toMatchObject({
            id,
          });
        }
        expect(await client.pluginContainer.resolveId(id)).toMatchObject({ id });
        expect(await client.pluginContainer.resolveId(`${id}?x`)).toMatchObject({ id: `${id}?x` });
        // The watch edge from its own module answers with the real file.
        expect(await client.pluginContainer.resolveId("./useToggle.uf.ts", id)).toMatchObject({
          id: join(composables.root, "useToggle.uf.ts"),
        });
        const scanning = { scan: true } as Parameters<typeof client.pluginContainer.resolveId>[2];
        expect(
          await client.pluginContainer.resolveId("./useToggle.uf.ts", main, scanning),
        ).toMatchObject({ id: `${SCAN_ID_PREFIX}${join(composables.root, "useToggle.uf.ts")}` });
      } finally {
        await server.close();
      }
    } finally {
      composables.remove();
    }
  });

  it("leaves Vite's file queries to the authored `.uf.ts`, and fails it loudly as itself", async () => {
    const composables = createProject(files);
    try {
      for (const name of ["svelte", "angular", "vue"] as const) {
        const server = await startServer(composables.root, unframework({ target: name }));
        try {
          const { client } = server;
          const main = join(composables.root, "main.ts");
          const authored = join(composables.root, "useToggle.uf.ts");
          for (const query of ["?raw", "?url"]) {
            const resolved = await client.pluginContainer.resolveId(
              `./useToggle.uf.ts${query}`,
              main,
            );
            expect(resolved?.id, `${name} ${query}`).toBe(`${authored}${query}`);
            // Vite's own plugins answer, with the authored file's text or its URL.
            expect(
              codeOf(await client.pluginContainer.load(resolved!.id)),
              `${name} ${query}`,
            ).toMatch(/^export default "/);
          }
          // On a target whose composable ids have a suffix, the authored file is never one.
          if (name !== "vue") {
            await expect(client.pluginContainer.load(authored), name).rejects.toThrow(
              `useToggle.uf.ts reached Vite as itself, which would load it as plain TypeScript rather than as its ${name} composables`,
            );
          }
        } finally {
          await server.close();
        }
      }
    } finally {
      composables.remove();
    }
  });

  it("fails a module of composables loudly on a target without `emitComposable`", async () => {
    const composables = createProject(files);
    try {
      const server = await startServer(composables.root, unframework({ target: "angular" }));
      try {
        const id = `${join(composables.root, "useToggle.uf.ts")}.ts`;
        await expect(server.client.pluginContainer.load(id)).rejects.toThrow(
          "error[UF1002] (angular): The angular target does not emit a composable yet",
        );
      } finally {
        await server.close();
      }
    } finally {
      composables.remove();
    }
  });

  it("loads what `emitComposable` emits, and resolves a caller's import of it to the module", async () => {
    const composables = createProject(files);
    try {
      const target = scripted();
      const server = await startServer(
        composables.root,
        unframework({ target, extension: ".html" }),
      );
      try {
        const { client } = server;
        const id = join(composables.root, "useToggle.uf.ts");
        expect(
          await client.pluginContainer.resolveId(
            "./useToggle.uf.ts",
            join(composables.root, "main.ts"),
          ),
        ).toMatchObject({ id });
        expect(codeOf(await client.pluginContainer.load(id))).toBe(
          "export function useToggle() {\n  return {};\n}\n",
        );
        expect(apiOf(server.server).getCompiled(id)).toBe(
          "export function useToggle() {\n  return {};\n}\n",
        );
        // A caller's output imports the composable's output, which the module's id loads.
        const caller = `${join(composables.root, "Switch.uf.tsx")}.html`;
        await client.pluginContainer.load(caller);
        expect(await client.pluginContainer.resolveId("./useToggle", caller)).toMatchObject({ id });
        expect(await client.pluginContainer.resolveId("./useToggle.ts", caller)).toMatchObject({
          id,
        });
      } finally {
        await server.close();
      }
    } finally {
      composables.remove();
    }
  });
});

/** Reads a project's file, as the compiler's file resolver and type oracle ask for it. */
async function readFile(path: string): Promise<string> {
  return readFileSync(path, "utf8");
}

describe("types read through the type oracle (ADR-0067)", () => {
  const TONES =
    'export type Tone = "info" | "warning";\nexport interface ChipProps { tone: Tone }\n';
  const CHIP =
    'import type { ChipProps } from "./tones.ts";\n\nexport default function Chip({ tone }: ChipProps) {\n  return <b class={tone}>{tone}</b>;\n}\n';
  const PANEL =
    'import Chip from "./Chip.uf.tsx";\n\nexport default function Panel() {\n  return <Chip tone="info" />;\n}\n';

  // A shared module's copy is no component's output (ADR-0070): a target that joins a file's
  // outputs keeps it out of the module, whose import of the module stays.
  it("joins no shared module's copy into an Angular module", async () => {
    const types = createProject({
      "tones.ts":
        'import { BASE } from "./base.ts";\n' + TONES + "export const sizes = { sm: BASE };\n",
      "base.ts": "export const BASE = 4;\n",
      "Chip.uf.tsx": CHIP,
    });
    try {
      const server = await startServer(types.root, [...unframework({ target: "angular" })]);
      try {
        const id = `${join(types.root, "Chip.uf.tsx")}${ID_SUFFIXES.angular}`;
        const code = codeOf(await server.client.pluginContainer.load(id));
        const typeOracle = createSyntacticOracle({ root: types.root, readFile });
        const compiled = await compile(CHIP, {
          filename: "Chip.uf.tsx",
          targets: ["angular"],
          resolve: createFileResolver({ root: types.root, readFile, typeOracle }),
          typeOracle,
        });
        await typeOracle.dispose();
        expect(compiled.outputs.angular!.map(({ path }) => path)).toEqual([
          "chip.ts",
          "tones.ts",
          "base.ts",
        ]);
        expect(code).toBe(compiled.outputs.angular![0]!.contents);
        expect(code).not.toContain("BASE");
      } finally {
        await server.close();
      }
    } finally {
      types.remove();
    }
  });

  it("compiles a component whose props type another module declares, and a parent of it", async () => {
    const types = createProject({ "tones.ts": TONES, "Chip.uf.tsx": CHIP, "Panel.uf.tsx": PANEL });
    try {
      const server = await startServer(types.root, [...unframework({ target: "vue" }), fakeVue]);
      try {
        const { client } = server;
        const chip = codeOf(
          await client.pluginContainer.load(`${join(types.root, "Chip.uf.tsx")}.vue`),
        );
        expect(chip).toContain("defineProps<ChipProps>()");
        const panel = `${join(types.root, "Panel.uf.tsx")}.vue`;
        expect(codeOf(await client.pluginContainer.load(panel))).toContain('<Chip tone="info" />');
        // A literal outside the union the child's imported alias names (UF3039).
        types.write("tones.ts", TONES.replace('"info" | ', ""));
        await expect(client.pluginContainer.load(panel)).rejects.toThrow("UF3039");
      } finally {
        await server.close();
      }
    } finally {
      types.remove();
    }
  });
});

describe("the golden guard (onCompile)", () => {
  it("receives every compile, and leaves a module it accepts alone", async () => {
    const events: CompileEvent[] = [];
    const plugins = [
      ...unframework({ target: "vue", onCompile: (event) => void events.push(event) }),
      fakeVue,
    ];
    await withServer(plugins, async ({ client }) => {
      const result = await client.transformRequest(vueId());
      const expected = await compile(HELLO, { filename: "Hello.uf.tsx", targets: ["vue"] });
      expect(result?.code).toBe(
        `export default ${JSON.stringify(expected.outputs.vue![0]!.contents)};\n`,
      );
      expect(events).toEqual([
        {
          id: vueId(),
          file: file("Hello.uf.tsx"),
          target: "vue",
          files: expected.outputs.vue,
          diagnostics: [],
          // What the module declares, for the harness's ufComponentEvents.
          ir: expected.ir,
        },
      ]);
    });
  });

  it("turns a module it fails into a throw after the framework's plugin, without failing load", async () => {
    const plugins = [
      ...unframework({ target: "vue", onCompile: () => "[uf guard] vue output differs" }),
      fakeVue,
    ];
    await withServer(plugins, async ({ server, client }) => {
      // load still answers with the compiled code, so the framework's plugin compiles it.
      expect(codeOf(await client.pluginContainer.load(vueId()))).toContain("<template>");
      const result = await client.transformRequest(vueId());
      expect(result?.code).toBe(
        'throw new Error("[uf guard] vue output differs");\nexport default undefined;\n',
      );
      const ssr = server.environments.ssr;
      if (!isRunnableDevEnvironment(ssr)) throw new Error("the ssr environment is not runnable");
      await expect(ssr.runner.import(vueId())).rejects.toThrow("[uf guard] vue output differs");
    });
  });

  it("keeps the module's named exports, so importers link and the message is reported", async () => {
    const plugins = [...unframework({ target: "react", onCompile: () => "stale golden" })];
    await withServer(plugins, async ({ client }) => {
      const failing = (await client.transformRequest(file("Multi.uf.tsx")))!;
      expect(failing.code).toBe(
        'throw new Error("stale golden");\nexport default undefined;\nconst failed = undefined;\nexport { failed as "Badge" };\n',
      );
      // Natively, an importer of the named export links, and the message is what it sees.
      const failingFile = project.write("failing.mjs", failing.code);
      const consumer = project.write(
        "consumer.mjs",
        `import Card, { Badge } from ${JSON.stringify(pathToFileURL(failingFile).href)};\nexport { Card, Badge };\n`,
      );
      await expect(import(pathToFileURL(consumer).href)).rejects.toThrow("stale golden");
    });
  });

  it("fails a module whose check throws, or says nothing, with a message", async () => {
    const verdicts: Record<string, () => string> = {
      throws: () => {
        throw new Error("golden unreadable");
      },
      empty: () => "",
    };
    for (const [name, onCompile] of Object.entries(verdicts)) {
      await withServer(
        [...unframework({ target: "vue", onCompile }), fakeVue],
        async ({ client }) => {
          const code = (await client.transformRequest(vueId()))?.code ?? "";
          expect(code, name).toMatch(
            name === "throws"
              ? /^throw new Error\("onCompile threw while checking .*Hello\.uf\.tsx\.vue: Error: golden unreadable/
              : /^throw new Error\("onCompile failed .*Hello\.uf\.tsx\.vue without a message\."\);/,
          );
        },
      );
    }
  });

  it("awaits an asynchronous check", async () => {
    await withServer(
      [...unframework({ target: "vue", onCompile: async () => "checked later" }), fakeVue],
      async ({ client }) => {
        expect((await client.transformRequest(vueId()))?.code).toContain(
          'throw new Error("checked later")',
        );
      },
    );
  });

  it("keeps each environment's verdict when client and ssr load a module at once", async () => {
    // The client's load fails the guard; while plugin-vue still transforms it, ssr starts
    // loading the same id, and its check is slower. The client must still be guarded, and
    // getCompiled must still answer, although an ssr load is under way.
    const clientInVue = Promise.withResolvers<void>();
    const releaseClient = Promise.withResolvers<void>();
    const ssrInGuard = Promise.withResolvers<void>();
    const releaseSsr = Promise.withResolvers<void>();
    let checks = 0;
    const onCompile = async () => {
      if (++checks === 2) {
        ssrInGuard.resolve();
        await releaseSsr.promise;
      }
      return "stale golden";
    };
    const slowVue: Plugin = {
      name: "slow-vue",
      transform: {
        filter: { id: /\.vue$/ },
        async handler(code) {
          if (this.environment.name === "client") {
            clientInVue.resolve();
            await releaseClient.promise;
          }
          return { code: `export default ${JSON.stringify(code)};\n`, map: null };
        },
      },
    };
    await withServer([...unframework({ target: "vue", onCompile }), slowVue], async (test) => {
      const { server, client } = test;
      try {
        const clientResult = client.transformRequest(vueId());
        await clientInVue.promise;
        const ssrResult = server.environments.ssr.transformRequest(vueId());
        await ssrInGuard.promise;
        expect(apiOf(server).getCompiled(vueId())).toContain("<template>");

        releaseClient.resolve();
        expect((await clientResult)?.code).toBe(
          'throw new Error("stale golden");\nexport default undefined;\n',
        );
        releaseSsr.resolve();
        expect((await ssrResult)?.code).toContain('throw new Error("stale golden");');
        expect(checks).toBe(2);
      } finally {
        // A failed expectation must not leave the requests waiting, or the server never closes.
        releaseClient.resolve();
        releaseSsr.resolve();
      }
    });
  });

  it("adds its message to a module that fails to compile", async () => {
    await withServer(
      unframework({ target: "vue", onCompile: () => "guard says no" }),
      async ({ client }) => {
        await expect(client.pluginContainer.load(`${file("Bad.uf.tsx")}.vue`)).rejects.toThrow(
          /error\[UF1201\][\s\S]*\n\nguard says no$/,
        );
      },
    );
  });
});

describe("watching", () => {
  it("adds the file to the module graph as an import of its module, so edits invalidate it", async () => {
    const watched = project.write("Watched.uf.tsx", HELLO);
    const id = `${watched}.vue`;
    await withServer([...unframework({ target: "vue" }), fakeVue], async ({ client }) => {
      expect((await client.transformRequest(id))?.code).toContain("Hello, world!");
      const [node, ...others] = client.moduleGraph.getModulesByFile(watched) ?? [];
      expect(others).toEqual([]);
      expect([...(node?.importers ?? [])].map((parent) => parent.id)).toEqual([id]);

      writeFileSync(watched, HELLO.replace("Hello, world!", "Hello, edit!"));
      client.moduleGraph.onFileChange(watched);
      expect(client.moduleGraph.getModuleById(id)?.transformResult).toBeNull();
      expect((await client.transformRequest(id))?.code).toContain("Hello, edit!");
    });
  });
});

/** A component that renders `Field` with a prop it does not declare yet. */
const rendersField = (name: string) =>
  `import Field from "./Field.uf.tsx";\n\nexport default function ${name}() {\n  return <Field label="Name" hint="Hi" />;\n}\n`;

/** The files a module's id imports in Vite's graph: its watch edges, relative to the root. */
const watchedBy = (graph: Project, client: TestServer["client"], id: string) =>
  [...(client.moduleGraph.getModuleById(id)?.importedModules ?? [])]
    .map((module) => relative(graph.root, module.file!))
    .toSorted();

/** The props and the error codes of the last compile `onCompile` saw for an id. */
const lastCompile = (events: CompileEvent[], id: string) => {
  const event = events.findLast((each) => each.id === id)!;
  return {
    props: event.ir?.components[0]?.props.map(({ name }) => name),
    errors: event.diagnostics
      .filter(({ severity }) => severity === "error")
      .map(({ code }) => code),
  };
};

/** Loads an id that may fail to compile: `onCompile` sees it either way. */
const request = (client: TestServer["client"], id: string) =>
  client.transformRequest(id).catch(() => undefined);

/** Links a workspace package into `node_modules`, as pnpm does. */
const linkPackage = (graph: Project, name: string) => {
  mkdirSync(join(graph.root, "node_modules"), { recursive: true });
  symlinkSync(join(graph.root, "packages", name), join(graph.root, "node_modules", name));
};

/**
 * A library's playground, which imports the library's types by its name. The comment goes before
 * the import, so an edit to it moves the props type's span.
 */
const playgroundApp = (comment: string) =>
  `${comment}import type { CardProps } from "my-lib";\n\nexport default function App({ label }: CardProps) {\n  return <p>{label}</p>;\n}\n`;

describe("the project graph (ADR-0071)", () => {
  // The verification plan's invalidation fixture (C9), and a second shared module: `B` reads its
  // types from `a.ts` and `tokens.ts`, whose copies its output tree holds, `C` reaches `a.ts`
  // through `useC.uf.ts` alone, and `D` reads none.
  const PROPS = "export interface CardProps {\n  label: string;\n}\n";
  const TOKENS = 'export type Tone = "info" | "warning";\n';
  const HINTED = PROPS.replace("label: string;", "label: string;\n  hint?: string;");
  const FIELD =
    "export default function Field({ label }: { label: string }) {\n  return <i>{label}</i>;\n}\n";
  const GRAPH = {
    "a.ts": PROPS,
    "tokens.ts": TOKENS,
    "B.uf.tsx":
      'import type { CardProps } from "./a.ts";\nimport type { Tone } from "./tokens.ts";\n\nexport default function B({ label, tone }: CardProps & { tone?: Tone }) {\n  return <p class={tone}>{label}</p>;\n}\n',
    "useC.uf.ts":
      'import { computed } from "unframework";\nimport type { CardProps } from "./a.ts";\n\nexport function useC(card: CardProps) {\n  const text = computed(() => card.label);\n  return { text };\n}\n',
    "C.uf.tsx":
      'import { useC } from "./useC.uf.ts";\n\nexport default function C({ label }: { label: string }) {\n  const { text } = useC({ label });\n  return <p>{text.value}</p>;\n}\n',
    "D.uf.tsx": "export default function D() {\n  return <p>D</p>;\n}\n",
    // Loaded by the tests that need them, never by `withGraph`.
    "X.uf.tsx":
      'import type { CardProps } from "./a.ts";\n\nexport default function X({ label }: CardProps) {\n  return <p>{label}</p>;\n}\n',
    "Field.uf.tsx": FIELD,
    "Form.uf.tsx": rendersField("Form"),
    "Page.uf.tsx": rendersField("Page"),
    // A workspace package, which pnpm links into `node_modules` (`linkPackage`).
    "packages/tokens/package.json": JSON.stringify({ name: "tokens", types: "./index.ts" }),
    "packages/tokens/index.ts": PROPS,
    "P.uf.tsx":
      'import type { CardProps } from "tokens";\n\nexport default function P({ label }: CardProps) {\n  return <p>{label}</p>;\n}\n',
    // The same file by its path.
    "R.uf.tsx":
      'import type { CardProps } from "./packages/tokens/index.ts";\n\nexport default function R({ label }: CardProps) {\n  return <p>{label}</p>;\n}\n',
    // A dual build, whose types sit beside a `package.json` without a name.
    "packages/dual/package.json": JSON.stringify({ name: "dual", types: "./dist/esm/index.d.ts" }),
    "packages/dual/dist/esm/package.json": JSON.stringify({ type: "module" }),
    "packages/dual/dist/esm/index.d.ts": PROPS,
    // A package installed into `node_modules`, which Vite's watcher ignores.
    "node_modules/vendor/package.json": JSON.stringify({ name: "vendor", types: "./index.d.ts" }),
    "node_modules/vendor/index.d.ts": PROPS,
    "V.uf.tsx":
      'import type { CardProps } from "vendor";\n\nexport default function V({ label }: CardProps) {\n  return <p>{label}</p>;\n}\n',
    "Dual.uf.tsx":
      'import type { CardProps } from "dual";\n\nexport default function Dual({ label }: CardProps) {\n  return <p>{label}</p>;\n}\n',
  };

  /**
   * A target that emits each component as a `.vue` file, which plugin-vue's stand-in claims, a
   * composable's call included: no built-in target emits one until its composables lane lands.
   */
  const target = defineTarget({
    ...htmlTarget(),
    emit: (component) => [{ path: `${component.name}.vue`, contents: "<p></p>\n" }],
    emitComposable: (composable) => [
      { path: `${composable.name}.ts`, contents: `export function ${composable.name}() {}\n` },
    ],
  });

  /** Runs `fn` on a server over the fixture, counting the compiles of each module. */
  async function withGraph(
    fn: (context: {
      graph: Project;
      client: TestServer["client"];
      ids: Record<"B" | "C" | "D", string>;
      idOf: (name: string) => string;
      compiled: string[];
      events: CompileEvent[];
    }) => Promise<void>,
  ) {
    const graph = createProject(GRAPH);
    const compiled: string[] = [];
    const events: CompileEvent[] = [];
    const counter: CompilerPlugin = {
      name: "counter",
      ir: (module) => void compiled.push(module.file),
    };
    const plugins = unframework({
      target,
      extension: ".vue",
      plugins: [counter],
      onCompile: (event) => void events.push(event),
    });
    try {
      const server = await startServer(graph.root, [...plugins, fakeVue]);
      try {
        const idOf = (name: string) => `${join(graph.root, `${name}.uf.tsx`)}.vue`;
        const ids = { B: idOf("B"), C: idOf("C"), D: idOf("D") };
        for (const each of Object.values(ids)) await server.client.transformRequest(each);
        await fn({ graph, client: server.client, ids, idOf, compiled, events });
      } finally {
        await server.close();
      }
    } finally {
      graph.remove();
    }
  }

  it("watches a module's `.ts`, `.uf.ts` and type dependencies", async () => {
    await withGraph(async ({ graph, client, ids }) => {
      const watched = (id: string) => watchedBy(graph, client, id);
      expect(watched(ids.B)).toEqual(["B.uf.tsx", "a.ts", "tokens.ts"]);
      // C reaches the type through its composable's API.
      expect(watched(ids.C)).toEqual(["C.uf.tsx", "a.ts", "useC.uf.ts"]);
      expect(watched(ids.D)).toEqual(["D.uf.tsx"]);
    });
  });

  it.each([
    ["a.ts", ["B", "C"]],
    ["useC.uf.ts", ["C"]],
    ["tokens.ts", ["B"]],
  ] as const)("invalidates the modules that depend on %s, and only them", async (path, names) => {
    await withGraph(async ({ graph, client, ids }) => {
      const edited = join(graph.root, path);
      writeFileSync(edited, `${readFileSync(edited, "utf8")}\n`);
      client.moduleGraph.onFileChange(edited);
      for (const [name, id] of Object.entries(ids)) {
        const result = client.moduleGraph.getModuleById(id)?.transformResult;
        if ((names as readonly string[]).includes(name)) expect(result, name).toBeNull();
        else expect(result, name).not.toBeNull();
      }
    });
  });

  it("compiles again exactly the dependents of a type it changed", async () => {
    await withGraph(async ({ graph, client, ids, compiled }) => {
      expect(compiled.toSorted()).toEqual(["B.uf.tsx", "C.uf.tsx", "D.uf.tsx"]);
      compiled.length = 0;
      graph.write("a.ts", PROPS.replace("label: string;", "label: string;\n  hint?: string;"));
      client.moduleGraph.onFileChange(join(graph.root, "a.ts"));
      for (const id of Object.values(ids)) await client.transformRequest(id);
      expect(compiled.toSorted()).toEqual(["B.uf.tsx", "C.uf.tsx"]);
    });
  });

  it("watches what a module of composables depends on", async () => {
    await withGraph(async ({ graph, client }) => {
      // Its id is the file itself on this target (ADR-0069), so only its dependency is an edge.
      const id = join(graph.root, "useC.uf.ts");
      await client.transformRequest(id);
      expect(watchedBy(graph, client, id)).toEqual(["a.ts"]);
    });
  });

  it("sees an edit in a module first compiled after it, and in those compiled before", async () => {
    await withGraph(async ({ graph, client, ids, idOf, events }) => {
      graph.write("a.ts", HINTED);
      // Never loaded before the edit: its compile reads `a.ts` before B's does again.
      await request(client, idOf("X"));
      expect(lastCompile(events, idOf("X")).props).toEqual(["label", "hint"]);
      client.moduleGraph.onFileChange(join(graph.root, "a.ts"));
      await request(client, ids.B);
      expect(lastCompile(events, ids.B).props).toContain("hint");
    });
  });

  it("sees a child's edit in a parent first compiled after it, and in those compiled before", async () => {
    await withGraph(async ({ graph, client, idOf, events }) => {
      await request(client, idOf("Form"));
      expect(lastCompile(events, idOf("Form")).errors).toEqual(["UF3035"]);
      graph.write("Field.uf.tsx", FIELD.replace("label: string", "label: string; hint?: string"));
      await request(client, idOf("Page"));
      expect(lastCompile(events, idOf("Page")).errors).toEqual([]);
      client.moduleGraph.onFileChange(join(graph.root, "Field.uf.tsx"));
      await request(client, idOf("Form"));
      expect(lastCompile(events, idOf("Form")).errors).toEqual([]);
    });
  });

  it("watches a workspace package's types, and reads them again when they change", async () => {
    await withGraph(async ({ graph, client, idOf, events }) => {
      linkPackage(graph, "tokens");
      const id = idOf("P");
      await request(client, id);
      expect(lastCompile(events, id).props).toEqual(["label"]);
      expect(watchedBy(graph, client, id)).toEqual(["P.uf.tsx", "packages/tokens/index.ts"]);
      graph.write("packages/tokens/index.ts", HINTED);
      client.moduleGraph.onFileChange(join(graph.root, "packages/tokens/index.ts"));
      expect(client.moduleGraph.getModuleById(id)?.transformResult).toBeNull();
      await request(client, id);
      expect(lastCompile(events, id).props).toEqual(["label", "hint"]);
    });
  });

  it.each([
    ["by its package's name first", ["P", "R"]],
    ["by its path first", ["R", "P"]],
  ])("sees an edit to a file that modules import %s, and by the other", async (_, names) => {
    await withGraph(async ({ graph, client, idOf, events }) => {
      linkPackage(graph, "tokens");
      for (const name of names) await request(client, idOf(name));
      graph.write("packages/tokens/index.ts", HINTED);
      client.moduleGraph.onFileChange(join(graph.root, "packages/tokens/index.ts"));
      for (const name of names) {
        await request(client, idOf(name));
        expect(lastCompile(events, idOf(name)).props, name).toEqual(["label", "hint"]);
      }
    });
  });

  it("sees edits to a module that imports its own root package by name, and to the package", async () => {
    await withGraph(async ({ graph, client, events }) => {
      // A component library's playground.
      graph.write(
        "package.json",
        JSON.stringify({ name: "my-lib", exports: { ".": { types: "./src/index.ts" } } }),
      );
      graph.write("src/index.ts", PROPS);
      const appFile = graph.write("playground/App.uf.tsx", playgroundApp(""));
      const id = `${appFile}.vue`;
      await request(client, id);
      expect(lastCompile(events, id)).toEqual({ props: ["label"], errors: [] });
      graph.write("playground/App.uf.tsx", playgroundApp("// The playground.\n"));
      client.moduleGraph.onFileChange(appFile);
      await request(client, id);
      expect(lastCompile(events, id)).toEqual({ props: ["label"], errors: [] });
      graph.write("src/index.ts", HINTED);
      client.moduleGraph.onFileChange(join(graph.root, "src/index.ts"));
      await request(client, id);
      expect(lastCompile(events, id)).toEqual({ props: ["label", "hint"], errors: [] });
    });
  });

  it("watches no installed package's file, and still reads it again on the next load", async () => {
    await withGraph(async ({ graph, client, idOf, events }) => {
      const id = idOf("V");
      await request(client, id);
      expect(watchedBy(graph, client, id)).toEqual(["V.uf.tsx"]);
      graph.write("node_modules/vendor/index.d.ts", HINTED);
      client.moduleGraph.invalidateAll();
      await request(client, id);
      expect(lastCompile(events, id).props).toEqual(["label", "hint"]);
    });
  });

  it("reads a package's types again beside a `package.json` without a name", async () => {
    await withGraph(async ({ graph, client, idOf, events }) => {
      linkPackage(graph, "dual");
      const id = idOf("Dual");
      await request(client, id);
      expect(lastCompile(events, id).props).toEqual(["label"]);
      const types = join(graph.root, "packages/dual/dist/esm/index.d.ts");
      expect(watchedBy(graph, client, id)).toContain("packages/dual/dist/esm/index.d.ts");
      graph.write("packages/dual/dist/esm/index.d.ts", HINTED);
      client.moduleGraph.onFileChange(types);
      await request(client, id);
      expect(lastCompile(events, id).props).toEqual(["label", "hint"]);
    });
  });

  it("gives the guard each shared module's copy, as the module now holds it", async () => {
    await withGraph(async ({ graph, client, ids, compiled, events }) => {
      const filesOf = () => events.findLast((event) => event.id === ids.B)!.files;
      const typeOracle = createSyntacticOracle({ root: graph.root, readFile });
      const direct = await compile(GRAPH["B.uf.tsx"], {
        filename: "B.uf.tsx",
        targets: [target],
        resolve: createFileResolver({ root: graph.root, readFile, typeOracle }),
        typeOracle,
      });
      await typeOracle.dispose();
      expect(filesOf()).toEqual(direct.outputs.html);
      expect(filesOf().map(({ path }) => path)).toEqual(["B.vue", "a.ts", "tokens.ts"]);
      // An edit that leaves the types alone compiles nothing, and the copy holds the new text.
      compiled.length = 0;
      const tokens = `${TOKENS}export const TONES: Tone[] = ["info", "warning"];\n`;
      graph.write("tokens.ts", tokens);
      client.moduleGraph.onFileChange(join(graph.root, "tokens.ts"));
      await client.transformRequest(ids.B);
      expect(compiled).toEqual([]);
      expect(filesOf().find(({ path }) => path === "tokens.ts")?.contents).toBe(tokens);
    });
  });
});

describe("api.getCompiled", () => {
  it("returns what load returned for an id, and nothing once it fails", async () => {
    const flaky = project.write("Flaky.uf.tsx", HELLO);
    const id = `${flaky}.ts`;
    await withServer(unframework({ target: "angular" }), async ({ server, client }) => {
      const api = apiOf(server);
      expect(api.getCompiled(id)).toBeUndefined();
      const code = codeOf(await client.pluginContainer.load(id));
      expect(code).toContain("@Component(");
      expect(api.getCompiled(id)).toBe(code);
      writeFileSync(flaky, BAD);
      await expect(client.pluginContainer.load(id)).rejects.toThrow("UF1201");
      expect(api.getCompiled(id)).toBeUndefined();
    });
  });
});

// Angular's ngtsc reads a `styleUrl` itself, so Vite never loads its sheet (ADR-0063).
describe("api.getSheet", () => {
  it("returns the sheet the last load of a file emitted, after the output hooks", async () => {
    const marked: CompilerPlugin = {
      name: "marked-sheet",
      output: (files) =>
        files.map((output) =>
          output.path.endsWith(".css")
            ? { ...output, contents: `/* hooked */\n${output.contents}` }
            : output,
        ),
    };
    await withServer(
      unframework({ target: "angular", plugins: [marked] }),
      async ({ server, client }) => {
        const api = apiOf(server);
        expect(api.getSheet(file("Card.uf.tsx"))).toBeUndefined();
        await client.pluginContainer.load(`${file("Card.uf.tsx")}.ts`);
        expect(api.getSheet(file("Card.uf.tsx"))).toMatch(
          /^\/\* hooked \*\/\n\.card\[data-uf-[0-9a-f]{8}\] \{ color: red \}\n$/,
        );
        // A file that imports no stylesheet emits none, and one that stops importing its own
        // has none from then on.
        await client.pluginContainer.load(`${file("Hello.uf.tsx")}.ts`);
        expect(api.getSheet(file("Hello.uf.tsx"))).toBeUndefined();
        const styled = project.write("Restyled.uf.tsx", CARD);
        await client.pluginContainer.load(`${styled}.ts`);
        expect(api.getSheet(styled)).toContain(".card[data-uf-");
        writeFileSync(styled, CARD.replace('import "./Card.css";\n\n', ""));
        await client.pluginContainer.load(`${styled}.ts`);
        expect(api.getSheet(styled)).toBeUndefined();
      },
    );
  });
});

/** A capability cell the target cannot support, reported with `severity`. */
function unsupported(severity: "warning" | "info"): CapabilityCell {
  return { support: "unsupported", code: "UF4001", severity, reason: "it is a test target." };
}

/** A third-party target that emits `<p></p>` into `<Name>.html`. */
function htmlTarget() {
  const capabilities: Capabilities = {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    listbox: { support: "native" },
    interactivity: { support: "native" },
    props: { support: "native" },
    interpolation: { support: "native" },
    conditional: { support: "native" },
    list: { support: "native" },
    fragment: { support: "native" },
    "bound-attribute": { support: "native" },
    "class-binding": { support: "native" },
    "style-binding": { support: "native" },
    "attribute-spread": { support: "native" },
    svg: { support: "native" },
    "event-capture": { support: "native" },
    "event-once": { support: "native" },
    "event-passive": { support: "native" },
    "event-semantics": { support: "native" },
    "conditional-event-control": { support: "native" },
    "use-id": { support: "native" },
    "next-tick": { support: "native" },
    "late-prop": { support: "native" },
    component: { support: "native" },
    "component-event": { support: "native" },
    "default-slot": { support: "native" },
    "named-slot": { support: "native" },
    "scoped-slot": { support: "native" },
    "slot-fallback": { support: "native" },
    "default-slot-presence": { support: "native" },
    "slot-forwarding": { support: "native" },
    model: { support: "native" },
    "two-way-binding": { support: "native" },
    "model-array": { support: "native" },
    "model-modifiers": { support: "native" },
    fallthrough: { support: "native" },
    "contextual-root": { support: "native" },
    expose: { support: "native" },
    context: { support: "native" },
    "reactive-context": { support: "native" },
    "dynamic-component": { support: "native" },
    "scoped-styles": { support: "native" },
    "child-root-scope": { support: "native" },
    "slotted-styles": { support: "native" },
    "sheet-order": { support: "native" },
    "generic-components": { support: "native" },
    "generic-slot-props": { support: "native" },
    composables: { support: "native" },
    "composable-effect-order": { support: "native" },
  };
  return defineTarget({
    name: "html",
    framework: { package: "none", range: "*" },
    capabilities,
    emit: (component) => [{ path: `${component.name}.html`, contents: "<p></p>\n" }],
  });
}
