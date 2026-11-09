// Packages that ship `.uf.tsx` sources, resolved through their `exports` (ADR-0075), on real Vite
// servers and builds with each framework's own plugin. The project sits under this package,
// gitignored, because the outputs import their frameworks from the project's own directory.
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

import type { Toolchain } from "@unframework/codegen";
import type { TargetName } from "@unframework/compiler";
import { toolchain as angular } from "@unframework/target-angular/toolchain";
import { toolchain as qwik } from "@unframework/target-qwik/toolchain";
import { toolchain as react } from "@unframework/target-react/toolchain";
import { toolchain as solid } from "@unframework/target-solid/toolchain";
import { toolchain as svelte } from "@unframework/target-svelte/toolchain";
import { toolchain as vue } from "@unframework/target-vue/toolchain";
import { build as astroBuild, dev as astroDev } from "astro";
import { build, createServer } from "vite";
import type { InlineConfig, Rollup, ViteDevServer } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import astro from "../src/astro.ts";
import { ID_SUFFIXES } from "../src/index.ts";
import unframework from "../src/vite.ts";
import { apiOf, codeOf, startServer } from "./fixtures.ts";

// A real framework compiles every module here, and a build bundles its runtime.
const SLOW = 180_000;

const HOST = "127.0.0.1";

const HERE = fileURLToPath(new URL("..", import.meta.url));
const ANGULAR_TOOLCHAIN = join(HERE, "../../tests/toolchains/angular");

const BUTTON =
  'import "./Button.css";\nimport Icon from "./Icon.uf.tsx";\nimport type { Tone } from "./types";\n\nexport default function Button({ tone = "calm" }: { tone?: Tone }) {\n  return <button class="kit" data-tone={tone}><Icon />Kit button</button>;\n}\n';
const ICON = 'export default function Icon() {\n  return <i class="icon">Kit icon</i>;\n}\n';
const TOGGLE =
  'import { ref } from "unframework";\n\nexport function useToggle() {\n  const on = ref(false);\n  return { on };\n}\n';

/** The package as npm installs it: a `./source/*` subpath, and entries that hide the extension. */
const KIT: Record<string, string> = {
  "package.json": JSON.stringify({
    name: "@ds/kit",
    type: "module",
    exports: {
      "./source/*": "./src/*",
      "./button": "./src/Button.uf.tsx",
      "./use-toggle": "./src/useToggle.uf.ts",
    },
  }),
  "src/Button.uf.tsx": BUTTON,
  "src/Button.css": ".kit { color: red; }\n",
  "src/Icon.uf.tsx": ICON,
  "src/types.ts": 'export type Tone = "calm" | "loud";\n',
  "src/useToggle.uf.ts": TOGGLE,
};

const installed = (at: string, files: Record<string, string> = KIT) =>
  Object.fromEntries(Object.entries(files).map(([path, text]) => [`${at}/${path}`, text]));

const MAIN = [
  'import Button from "@ds/kit/button";',
  'import Source from "@ds/kit/source/Button.uf.tsx";',
  'import { useToggle } from "@ds/kit/use-toggle";',
  "",
  "export { Button, Source, useToggle };",
  "",
].join("\n");

let roots: string[] = [];

function write(root: string, path: string, contents: string): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

function createRoot(files: Record<string, string>): string {
  mkdirSync(join(HERE, ".uf-tmp"), { recursive: true });
  const root = realpathSync(mkdtempSync(join(HERE, ".uf-tmp", "packages-")));
  roots.push(root);
  for (const [path, contents] of Object.entries(files)) write(root, path, contents);
  return root;
}

function createKitRoot(target: TargetName): string {
  const root = createRoot({ "main.ts": MAIN, ...installed("node_modules/@ds/kit") });
  if (target === "angular") {
    // Angular's packages live with its toolchain, which this package does not depend on.
    for (const name of ["@angular", "rxjs", "tslib"]) {
      symlinkSync(join(ANGULAR_TOOLCHAIN, "node_modules", name), join(root, "node_modules", name));
    }
  }
  return root;
}

const toolchainDir = (target: TargetName, root: string) =>
  target === "angular" ? ANGULAR_TOOLCHAIN : root;

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots = [];
});

const VITE_TARGETS: [TargetName, Toolchain][] = [
  ["react", react],
  ["vue", vue],
  ["svelte", svelte],
  ["solid", solid],
  ["qwik", qwik],
  ["angular", angular],
];

/** A Vite configuration for one target's project, its framework's own plugins included. */
async function configOf(
  target: TargetName,
  toolchain: Toolchain,
  root: string,
  mode: "browser" | "ssr",
): Promise<InlineConfig> {
  const framework = await toolchain.vite(mode, { root, toolchainDir: toolchainDir(target, root) });
  const { test: _test, ...vite } = framework as InlineConfig & { test?: unknown };
  return {
    ...vite,
    root,
    configFile: false,
    appType: "custom",
    clearScreen: false,
    logLevel: "silent",
    plugins: [...unframework({ target }), ...(vite.plugins ?? [])],
  };
}

const devConfig = (config: InlineConfig): InlineConfig => ({
  ...config,
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});

/** Every module a browser would fetch from `/main.ts`, the package's own included, by URL. */
async function fetchAll(server: ViteDevServer): Promise<Map<string, string>> {
  const client = server.environments.client;
  const seen = new Map<string, string>();
  const visit = async (url: string): Promise<void> => {
    if (seen.has(url)) return;
    const result = await client.transformRequest(url);
    seen.set(url, result?.code ?? "");
    // `import(` too: Qwik's optimizer moves each component's body into a lazily imported segment.
    for (const [, imported] of result?.code.matchAll(/(?:from|import\(?)\s*["']([^"']+)["']/g) ??
      []) {
      const next = imported!.startsWith(".")
        ? posix.join(posix.dirname(url), imported!)
        : imported!;
      // Only the project's and the package's modules: a framework's runtime is no part of this.
      if (next.startsWith("/") && /\/@ds\/|^\/main/.test(next)) await visit(next);
    }
  };
  await visit("/main.ts");
  return seen;
}

const joined = (modules: ReadonlyMap<string, string>) => [...modules.values()].join("\n");

/** The text of every chunk a build wrote. */
const chunksOf = (output: unknown): string => {
  const outputs = (Array.isArray(output) ? output : [output]) as Rollup.RollupOutput[];
  return outputs
    .flatMap((each) => each.output)
    .map((chunk) => (chunk.type === "chunk" ? chunk.code : String(chunk.source)))
    .join("\n");
};

const buildOptions = (root: string, ssr: boolean): InlineConfig["build"] => ({
  write: false,
  minify: false,
  ...(ssr ? { ssr: join(root, "main.ts") } : { rollupOptions: { input: join(root, "main.ts") } }),
  rollupOptions: {
    ...(ssr ? {} : { input: join(root, "main.ts") }),
    preserveEntrySignatures: "exports-only",
  },
});

describe.each(VITE_TARGETS)("a package's sources on %s", (target, toolchain) => {
  const suffix = ID_SUFFIXES[target];

  it("loads them in dev, with the dependency optimiser on", { timeout: SLOW }, async () => {
    const root = createKitRoot(target);
    const config = await configOf(target, toolchain, root, "browser");
    const server = await createServer(devConfig(config));
    try {
      const modules = await fetchAll(server);
      const code = joined(modules);
      expect(code).toContain("Kit button");
      // Its child, found through the output's relative import inside the package.
      expect(code).toContain("Kit icon");
      const ids = [...server.environments.client.moduleGraph.idToModuleMap.keys()];
      expect(ids).toContain(join(root, `node_modules/@ds/kit/src/Button.uf.tsx${suffix}`));
      // The scan runs apart from the requests, and may discover more after them.
      await server.environments.client.depsOptimizer?.scanProcessing;
      const optimized = server.environments.client.depsOptimizer?.metadata.depInfoList ?? [];
      expect(optimized.map((dep) => dep.id).filter((id) => id.includes("@ds/kit"))).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("loads them through SSR, in the module graph", { timeout: SLOW }, async () => {
    const root = createKitRoot(target);
    const config = await configOf(target, toolchain, root, "ssr");
    // The client's optimiser has no part in an SSR load, and a re-bundle mid-load would fail it.
    const server = await createServer({
      ...devConfig(config),
      optimizeDeps: { ...config.optimizeDeps, noDiscovery: true, include: [] },
    });
    try {
      const loaded = await server.ssrLoadModule("/main.ts");
      expect(loaded.Button).toBeDefined();
      expect(loaded.Source).toBe(loaded.Button);
      expect(loaded.useToggle).toBeTypeOf("function");
      const ids = [...server.environments.ssr.moduleGraph.idToModuleMap.keys()];
      expect(ids).toContain(join(root, `node_modules/@ds/kit/src/Button.uf.tsx${suffix}`));
    } finally {
      await server.close();
    }
  });

  it("bundles them in a build", { timeout: SLOW }, async () => {
    const root = createKitRoot(target);
    const config = await configOf(target, toolchain, root, "browser");
    const code = chunksOf(await build({ ...config, build: buildOptions(root, false) }));
    expect(code).toContain("Kit button");
    expect(code).toContain("Kit icon");
  });

  it("bundles them in an SSR build", { timeout: SLOW }, async () => {
    const root = createKitRoot(target);
    const config = await configOf(target, toolchain, root, "ssr");
    const code = chunksOf(await build({ ...config, build: buildOptions(root, true) }));
    expect(code).toContain("Kit button");
  });
});

describe("a package's sources on astro", () => {
  const PAGE =
    '---\nimport Button from "@ds/kit/button";\nimport Source from "@ds/kit/source/Button.uf.tsx";\nimport { useToggle } from "@ds/kit/use-toggle";\nconst { on } = useToggle();\n---\n<html><body><Button /><Source tone="loud" /><p>{String(on)}</p></body></html>\n';
  const createAstroRoot = () =>
    createRoot({ "src/pages/index.astro": PAGE, ...installed("node_modules/@ds/kit") });

  beforeEach(() => {
    vi.stubEnv("ASTRO_TELEMETRY_DISABLED", "1");
    vi.stubEnv("ASTRO_DISABLE_UPDATE_CHECK", "true");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("renders them under astro build", { timeout: SLOW }, async () => {
    const root = createAstroRoot();
    await astroBuild({
      root,
      configFile: false,
      logLevel: "silent",
      devToolbar: { enabled: false },
      integrations: [astro()],
    });
    const html = readFileSync(join(root, "dist/index.html"), "utf8");
    expect(html).toContain("Kit button");
    expect(html).toContain("Kit icon");
    expect(html).toContain('data-tone="loud"');
  });

  it("renders them under astro dev", { timeout: SLOW }, async () => {
    // Astro's dev server adds no route handling while `VITEST` is set.
    vi.stubEnv("VITEST", "");
    const root = createAstroRoot();
    const server = await astroDev({
      root,
      configFile: false,
      logLevel: "silent",
      devToolbar: { enabled: false },
      server: { host: HOST, port: 0 },
      integrations: [astro()],
    });
    try {
      const response = await fetch(`http://${HOST}:${server.address.port}/`);
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(html).toContain("Kit button");
      expect(html).toContain("Kit icon");
    } finally {
      await server.stop();
    }
  });
});

describe("how a package's source resolves", () => {
  it("compiles every form of the specifier to the one module", { timeout: SLOW }, async () => {
    const root = createRoot({ "main.ts": "", ...installed("node_modules/@ds/kit") });
    const test = await startServer(root, unframework({ target: "vue" }));
    try {
      const expected = join(root, "node_modules/@ds/kit/src/Button.uf.tsx.vue");
      const resolve = (id: string) =>
        test.client.pluginContainer.resolveId(id, join(root, "main.ts"));
      expect((await resolve("@ds/kit/button"))?.id).toBe(expected);
      expect((await resolve("@ds/kit/source/Button.uf.tsx"))?.id).toBe(expected);
      expect((await resolve("@ds/kit/source/Button.uf.tsx?container"))?.id).toBe(
        `${expected}?container`,
      );
      expect((await resolve("@ds/kit/use-toggle"))?.id).toBe(
        join(root, "node_modules/@ds/kit/src/useToggle.uf.ts"),
      );
      // A subpath that names another kind of file, and one no entry names, stay Vite's.
      expect((await resolve("@ds/kit/source/types.ts"))?.id).toBe(
        join(root, "node_modules/@ds/kit/src/types.ts"),
      );
      await expect(resolve("@ds/kit/missing")).rejects.toThrow("is not exported");
      expect(await resolve("not-installed/Button.uf.tsx")).toBeNull();
    } finally {
      await test.close();
    }
  });

  it("gives Vite's file queries back the authored file", { timeout: SLOW }, async () => {
    const root = createRoot({ "main.ts": "", ...installed("node_modules/@ds/kit") });
    const test = await startServer(root, unframework({ target: "vue" }));
    try {
      const resolved = await test.client.pluginContainer.resolveId(
        "@ds/kit/source/Button.uf.tsx?raw",
        join(root, "main.ts"),
      );
      expect(resolved?.id).toBe(`${join(root, "node_modules/@ds/kit/src/Button.uf.tsx")}?raw`);
    } finally {
      await test.close();
    }
  });

  it("gives the scan an id it leaves out of the optimiser", { timeout: SLOW }, async () => {
    const root = createRoot({ "main.ts": "", ...installed("node_modules/@ds/kit") });
    const test = await startServer(root, unframework({ target: "vue" }));
    try {
      const resolved = await test.client.pluginContainer.resolveId(
        "@ds/kit/button",
        join(root, "main.ts"),
        // Vite's dependency scanner passes `scan`, which the public type omits.
        { scan: true } as Parameters<typeof test.client.pluginContainer.resolveId>[2],
      );
      expect(resolved?.id).toBe(
        `\0uf-scan:${join(root, "node_modules/@ds/kit/src/Button.uf.tsx")}`,
      );
    } finally {
      await test.close();
    }
  });

  it("follows a subpath import to a source", { timeout: SLOW }, async () => {
    const root = createRoot({
      "package.json": JSON.stringify({
        name: "app",
        imports: { "#button": "@ds/kit/button", "#local": "./src/Local.uf.tsx" },
      }),
      "main.ts": "",
      "src/Local.uf.tsx": ICON,
      ...installed("node_modules/@ds/kit"),
    });
    const test = await startServer(root, unframework({ target: "vue" }));
    try {
      const resolve = (id: string) =>
        test.client.pluginContainer.resolveId(id, join(root, "main.ts"));
      expect((await resolve("#local"))?.id).toBe(join(root, "src/Local.uf.tsx.vue"));
      expect((await resolve("#button"))?.id).toBe(
        join(root, "node_modules/@ds/kit/src/Button.uf.tsx.vue"),
      );
    } finally {
      await test.close();
    }
  });

  it("leaves a scheme and a passed-through prefix alone", { timeout: SLOW }, async () => {
    const root = createRoot({ "main.ts": "" });
    const test = await startServer(root, unframework({ target: "vue" }));
    try {
      const resolve = (id: string) =>
        test.client.pluginContainer.resolveId(id, join(root, "main.ts"));
      expect(await resolve("virtual:styleframe")).toBeNull();
      expect(await resolve("styled-system/css")).toBeNull();
    } finally {
      await test.close();
    }
  });
});

describe("the graph of a package's source", () => {
  /** What the plugin compiles for the package's Button, from a project at `root`. */
  async function compiledAt(root: string, file: string): Promise<string> {
    const test = await startServer(root, unframework({ target: "vue" }));
    try {
      const id = `${file}.vue`;
      expect(codeOf(await test.client.pluginContainer.load(id))).toBeTypeOf("string");
      return apiOf(test.server).getCompiled(id)!;
    } finally {
      await test.close();
    }
  }

  it(
    "compiles a source the same wherever the package is installed",
    { timeout: SLOW },
    async () => {
      const root = createRoot({
        ...installed("node_modules/@ds/kit"),
        ...installed("deep/er/node_modules/.pnpm/@ds+kit@1.0.0/node_modules/@ds/kit"),
      });
      const flat = join(root, "node_modules/@ds/kit/src/Button.uf.tsx");
      const nested = join(
        root,
        "deep/er/node_modules/.pnpm/@ds+kit@1.0.0/node_modules/@ds/kit/src/Button.uf.tsx",
      );
      const fromFlat = await compiledAt(root, flat);
      expect(fromFlat).toContain("Kit button");
      expect(await compiledAt(root, nested)).toBe(fromFlat);
    },
  );

  it("names the package when one of its files fails to compile", { timeout: SLOW }, async () => {
    const root = createRoot(
      installed("node_modules/@ds/bad", {
        "package.json": JSON.stringify({ name: "@ds/bad", exports: { "./*": "./src/*" } }),
        "src/Bad.uf.tsx":
          'import { useState } from "react";\n\nexport default function Bad() {\n  return <p>{useState(0)[0]}</p>;\n}\n',
      }),
    );
    const test = await startServer(root, unframework({ target: "vue" }));
    try {
      const failure = test.client.pluginContainer.load(
        join(root, "node_modules/@ds/bad/src/Bad.uf.tsx.vue"),
      );
      // Named by the package's own root, not the path it happens to be installed at.
      await expect(failure).rejects.toThrow(/--> src\/Bad\.uf\.tsx:/);
      await expect(failure).rejects.toThrow("The file is in the package at node_modules/@ds/bad.");
    } finally {
      await test.close();
    }
  });

  it(
    "reads a linked package's file by its own root and sees an edit",
    { timeout: SLOW },
    async () => {
      const root = createRoot({
        "app/main.ts": "",
        ...installed("packages/kit"),
        "packages/kit/dist/esm/package.json": JSON.stringify({ type: "module" }),
      });
      mkdirSync(join(root, "app/node_modules/@ds"), { recursive: true });
      symlinkSync(join(root, "packages/kit"), join(root, "app/node_modules/@ds/kit"));
      const test = await startServer(join(root, "app"), unframework({ target: "vue" }));
      try {
        const { pluginContainer } = test.client;
        const resolved = await pluginContainer.resolveId(
          "@ds/kit/button",
          join(root, "app/main.ts"),
        );
        const id = join(root, "packages/kit/src/Button.uf.tsx.vue");
        expect(resolved?.id).toBe(id);
        expect(codeOf(await pluginContainer.load(id))).toContain("Kit button");
        write(root, "packages/kit/src/Button.uf.tsx", BUTTON.replace("Kit button", "Kit edited"));
        expect(codeOf(await pluginContainer.load(id))).toContain("Kit edited");
      } finally {
        await test.close();
      }
    },
  );
});
