import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { defineTarget } from "@unframework/codegen";
import type { Capabilities, CapabilityCell } from "@unframework/codegen";
import { compile, TARGET_NAMES } from "@unframework/compiler";
import type { CompilerPlugin } from "@unframework/compiler";
import { isRunnableDevEnvironment, optimizeDeps, resolveConfig } from "vite";
import type { Plugin } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ID_SUFFIXES, unframeworkUnplugin } from "../src/index.ts";
import type { CompileEvent } from "../src/index.ts";
import unframework from "../src/vite.ts";
import { apiOf, codeOf, createProject, fakeVue, HELLO, startServer } from "./fixtures.ts";
import type { Project, TestServer } from "./fixtures.ts";

const BAD =
  'import { useState } from "react";\n\nexport default function Bad() {\n  return <p>Bad</p>;\n}\n';
const MULTI =
  'export default function Card() {\n  return <section class="card">Card</section>;\n}\n\nexport function Badge() {\n  return <span class="badge">New</span>;\n}\n';
const NAMED = HELLO.replace("export default function", "export function");

let project: Project;
beforeAll(() => {
  project = createProject({
    "Hello.uf.tsx": HELLO,
    "Bad.uf.tsx": BAD,
    "Multi.uf.tsx": MULTI,
    "Named.uf.tsx": NAMED,
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
      ? "refuses a component exported by name, naming M3"
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
          `Named.uf.tsx exports \`Hello\` by name, and the module of a .${target} file has only a default export, so \`import { Hello }\` would find nothing on the ${target} target. Named exports of components on markup targets come with composition (M3)`,
        );
      });
    },
  );
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
      expect(code).toBe('<p class="greeting">Hello, world!</p>\n');
    });
  });

  it("loads a queried module id cold, whatever the process resolved before", async () => {
    await withServer(unframework({ target: "astro" }), async ({ client }) => {
      const id = `${file("Hello.uf.tsx")}.astro?container`;
      expect(codeOf(await client.pluginContainer.load(id))).toBe(
        '<p class="greeting">Hello, world!</p>\n',
      );
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
        // Each file's code, with an import the first file already made written once.
        const imports = card!.contents.match(/^import .*$/gm) ?? [];
        expect(code).toBe(
          `${card!.contents}\n${imports.reduce((rest, line) => rest.replace(`${line}\n`, ""), badge!.contents)}`,
        );
      });
    },
  );

  it("fail a markup target's module, naming M3", async () => {
    await withServer(unframework({ target: "svelte" }), async ({ client }) => {
      await expect(client.pluginContainer.load(`${file("Multi.uf.tsx")}.svelte`)).rejects.toThrow(
        "Multi.uf.tsx compiles to 2 svelte components (Card.svelte, Badge.svelte), and a .svelte file holds one",
      );
    });
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
  };
  return defineTarget({
    name: "html",
    framework: { package: "none", range: "*" },
    capabilities,
    emit: (component) => [{ path: `${component.name}.html`, contents: "<p></p>\n" }],
  });
}
