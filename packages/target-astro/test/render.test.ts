import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { createServer } from "vite";
import type { Plugin, ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { astroBrowserRef } from "../src/toolchain/browser.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { ASTRO_VIRTUAL_ID } from "../src/toolchain/protocol.ts";
import { closeAstroRenderServers, renderAstroComponent } from "../src/toolchain/render.ts";
import { compiledAstroSource } from "../src/toolchain/sources.ts";

const root = join(import.meta.dirname, "..", ".uf-tmp", `render-${process.pid}`);
const idOf = (name: string) => join(root, `${name}.uf.tsx.astro`);

/** What a browser project does when it imports a component: the ref plugin's transform. */
function compileInBrowserProject(name: string, source: string): unknown {
  const plugin = astroBrowserRef();
  const transform = plugin.transform as {
    handler(this: unknown, code: string, id: string): { code: string };
  };
  const { code } = transform.handler.call(undefined, source, idOf(name));
  return JSON.parse(code.replace(/^export default /, "").replace(/;\n$/, ""));
}

describe("the ufAstroRender command", { timeout: 60_000 }, () => {
  beforeAll(() => mkdirSync(root, { recursive: true }));
  afterAll(async () => {
    await closeAstroRenderServers();
    rmSync(root, { recursive: true, force: true });
  });

  it("turns the browser module into a reference and records its source", () => {
    const source = '<p class="greeting">Hello, world!</p>\n';
    expect(compileInBrowserProject("Hello", source)).toEqual({
      __ufTarget: "astro",
      id: idOf("Hello"),
      name: "Hello",
    });
    expect(compiledAstroSource(idOf("Hello"))).toBe(source);
  });

  it("renders what the browser project compiled, with props, through Astro's pipeline", async () => {
    compileInBrowserProject(
      "Greeting",
      '---\nconst { name = "world" } = Astro.props;\n---\n\n<p class="greeting">Hello, {name}!</p>\n',
    );
    const result = await renderAstroComponent(root, {
      id: idOf("Greeting"),
      props: { name: "<Astro>" },
    });
    // No `data-astro-source-*`: the dev toolbar is off.
    expect(result).toEqual({ html: '<p class="greeting">Hello, &lt;Astro&gt;!</p>', console: [] });
  });

  it("puts the component's own styles first", async () => {
    compileInBrowserProject("Styled", "<p>styled</p>\n<style>p { padding: 8px; }</style>\n");
    const { html } = await renderAstroComponent(root, { id: idOf("Styled"), props: {} });
    expect(html).toMatch(
      /^<style>p\[data-astro-cid-(\w+)\] \{\s*padding: 8px;\s*\}\s*<\/style><p data-astro-cid-\1>styled<\/p>$/,
    );
  });

  it("returns the warnings and errors the render logged, and leaves the console as it was", async () => {
    compileInBrowserProject(
      "Noisy",
      '---\nconsole.warn("careful:", 1);\nconsole.error("broken", { at: "frontmatter" });\n---\n\n<p>noisy</p>\n',
    );
    const { warn, error } = console;
    const result = await renderAstroComponent(root, { id: idOf("Noisy"), props: {} });
    expect(result.console).toEqual([
      { level: "warn", message: "careful: 1" },
      { level: "error", message: "broken { at: 'frontmatter' }" },
    ]);
    expect([console.warn, console.error]).toEqual([warn, error]);
  });

  it("captures only the render's own calls, not those other work makes meanwhile", async () => {
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => (entered = resolve));
    const gate = new Promise<void>((resolve) => (release = resolve));
    Object.assign(globalThis, { __ufTestGate: { entered, gate } });
    compileInBrowserProject(
      "Gated",
      '---\nconst { entered, gate } = (globalThis as any).__ufTestGate;\nentered();\nawait gate;\nconsole.warn("inside");\n---\n\n<p>gated</p>\n',
    );
    const original = console.warn;
    const elsewhere: unknown[][] = [];
    console.warn = (...args: unknown[]) => void elsewhere.push(args);
    try {
      const rendering = renderAstroComponent(root, { id: idOf("Gated"), props: {} });
      await started;
      console.warn("outside");
      release();
      expect((await rendering).console).toEqual([{ level: "warn", message: "inside" }]);
      expect(elsewhere).toEqual([["outside"]]);
    } finally {
      console.warn = original;
      Reflect.deleteProperty(globalThis, "__ufTestGate");
    }
  });

  it("renders the new source after the browser project recompiles", async () => {
    compileInBrowserProject("Live", "<p>v1</p>\n");
    expect((await renderAstroComponent(root, { id: idOf("Live"), props: {} })).html).toBe(
      "<p>v1</p>",
    );
    compileInBrowserProject("Live", "<p>v2</p>\n");
    expect((await renderAstroComponent(root, { id: idOf("Live"), props: {} })).html).toBe(
      "<p>v2</p>",
    );
  });

  it("rejects with the component's error when the render throws", async () => {
    compileInBrowserProject("Throws", '---\nthrow new Error("boom");\n---\n\n<p>never</p>\n');
    await expect(renderAstroComponent(root, { id: idOf("Throws"), props: {} })).rejects.toThrow(
      "boom",
    );
  });

  // ADR-0057: the browser imports only the component a spec mounts; its children are resolved
  // and compiled by the browser project's pipeline when the render server meets their import.
  describe("a component that imports a child", () => {
    const parent = (name: string, child = "Field") =>
      `---\nimport ${child} from "./${child}.astro";\n---\n\n<form aria-label="${name}"><${child} label="Name" /></form>\n`;
    const field = '---\nconst { label } = Astro.props;\n---\n\n<p class="field">{label}</p>\n';

    it("renders the child the browser project resolves and compiles on request", async () => {
      compileInBrowserProject("Form", parent("Form"));
      const asked: string[] = [];
      const children = {
        resolve: (specifier: string, importer: string) => {
          asked.push(`resolve ${specifier} from ${importer}`);
          return Promise.resolve(specifier === "./Field.astro" ? idOf("Field") : undefined);
        },
        load: (id: string) => {
          asked.push(`load ${id}`);
          compileInBrowserProject("Field", field);
          return Promise.resolve();
        },
      };
      const result = await renderAstroComponent(root, { id: idOf("Form"), props: {} }, children);
      expect(result).toEqual({
        html: '<form aria-label="Form"><p class="field">Name</p></form>',
        console: [],
      });
      expect(asked).toEqual([
        `resolve ./Field.astro from ${idOf("Form")}`,
        `load ${idOf("Field")}`,
      ]);
    });

    it("renders a child the browser project compiled again", async () => {
      compileInBrowserProject("Form", parent("Again"));
      compileInBrowserProject("Field", field.replace("field", "changed"));
      const children = {
        resolve: () => Promise.resolve(idOf("Field")),
        load: () => Promise.reject(new Error("already compiled")),
      };
      const { html } = await renderAstroComponent(root, { id: idOf("Form"), props: {} }, children);
      expect(html).toBe('<form aria-label="Again"><p class="changed">Name</p></form>');
    });

    // A real Vite client environment, as Vitest's browser project has: a stubbed plugin
    // container would skip Vite's own checks, such as import analysis's module-graph entry.
    describe("through a browser project's real Vite server", () => {
      /** The guard's failing module, as the unplugin's post plugin writes it. */
      const failing = 'throw new Error("[uf guard] Answer differs");\nexport default undefined;\n';
      let vite: ViteDevServer | undefined;
      const sources = new Map<string, string>();
      const guarded = new Set<string>();

      beforeAll(async () => {
        // A stand-in for the unframework plugin: it serves each virtual id's Astro source,
        // resolves a parent's import of `./<Name>.astro`, and fails what the guard fails.
        const unframework: Plugin = {
          name: "unframework",
          resolveId: (id, importer) => {
            if (ASTRO_VIRTUAL_ID.test(id)) return id;
            const name = /^\.\/(\w+)\.astro$/.exec(id)?.[1];
            return name && importer && ASTRO_VIRTUAL_ID.test(importer) ? idOf(name) : null;
          },
          load: (id) => sources.get(id) ?? null,
        };
        const guard: Plugin = {
          name: "unframework:guard",
          enforce: "post",
          transform: (_code, id) => (guarded.has(id) ? { code: failing, map: null } : null),
        };
        vite = await createServer({
          root,
          configFile: false,
          logLevel: "silent",
          cacheDir: join(root, "node_modules", ".vite", "browser"),
          plugins: [unframework, astroBrowserRef(), guard],
          optimizeDeps: { noDiscovery: true },
          server: { middlewareMode: true, hmr: false, ws: false, watch: null },
        });
      });
      afterAll(() => vite?.close());

      const render = (id: string) =>
        (
          toolchain.browserCommands!({ toolchainDir: root, root }).ufAstroRender as (
            context: unknown,
            request: { id: string; props: Record<string, unknown> },
          ) => Promise<{ html: string }>
        )({ project: { browser: { vite } } }, { id, props: {} });

      it("resolves and compiles the child there", async () => {
        compileInBrowserProject("Survey", parent("Survey", "Answer"));
        sources.set(idOf("Answer"), field.replace("field", "answer"));
        expect((await render(idOf("Survey"))).html).toBe(
          '<form aria-label="Survey"><p class="answer">Name</p></form>',
        );
        expect(compiledAstroSource(idOf("Answer"))).toBe(sources.get(idOf("Answer")));
      });

      it("fails with the golden guard's message when the guard fails the child", async () => {
        compileInBrowserProject("Quiz", parent("Quiz", "Guarded"));
        sources.set(idOf("Guarded"), field);
        guarded.add(idOf("Guarded"));
        await expect(render(idOf("Quiz"))).rejects.toThrow("[uf guard] Answer differs");
      });
    });

    it("fails when nothing resolves the child", async () => {
      compileInBrowserProject("Lonely", parent("Lonely"));
      await expect(renderAstroComponent(root, { id: idOf("Lonely"), props: {} })).rejects.toThrow(
        /Field\.astro/,
      );
    });
  });

  it("rejects with Astro's compile error", async () => {
    compileInBrowserProject("Broken", "<div><p>Hello</span></div>\n");
    await expect(renderAstroComponent(root, { id: idOf("Broken"), props: {} })).rejects.toThrow(
      "Closing tag '</span>' has no matching opening tag.",
    );
  });

  it("rejects a component no browser project compiled", async () => {
    await expect(renderAstroComponent(root, { id: idOf("Unknown"), props: {} })).rejects.toThrow(
      "was never compiled by a browser project",
    );
  });

  it("rejects an id that is not an Astro output", async () => {
    await expect(
      renderAstroComponent(root, { id: join(root, "Hello.uf.tsx"), props: {} }),
    ).rejects.toThrow("is not an Astro output id");
    await expect(
      renderAstroComponent(root, { id: `${idOf("Hello")}?container`, props: {} }),
    ).rejects.toThrow("is not an Astro output id");
  });

  it("is the toolchain's browser command, rendering in the project root", async () => {
    compileInBrowserProject("Command", "<p>from the command</p>\n");
    const commands = toolchain.browserCommands!({ toolchainDir: root, root });
    const render = commands.ufAstroRender as (
      context: unknown,
      request: { id: string; props: Record<string, unknown> },
    ) => Promise<unknown>;
    await expect(render({}, { id: idOf("Command"), props: {} })).resolves.toEqual({
      html: "<p>from the command</p>",
      console: [],
    });
  });
});
