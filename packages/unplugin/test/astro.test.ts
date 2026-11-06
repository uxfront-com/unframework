// Real Astro builds and an in-process dev server. The project sits under this package, gitignored,
// because Astro's output imports `astro/*` from the project's own directory.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build, dev } from "astro";
import type { AstroInlineConfig } from "astro";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import unframework from "../src/astro.ts";

// Astro and Vite load and bundle a project here, which takes far longer than a unit test.
const SLOW = 120_000;

const FILES: Record<string, string> = {
  "src/pages/index.astro":
    '---\nimport Card from "../components/Card.uf.tsx";\n---\n<html><body><Card label="Astro" /></body></html>\n',
  "src/components/Card.uf.tsx":
    'import "./Card.css";\nimport Field from "./Field.uf.tsx";\n\nexport default function Card({ label }: { label: string }) {\n  return <section class="card"><Field /><p>Hello, {label}!</p></section>;\n}\n',
  "src/components/Card.css": ".card { color: rebeccapurple; }\n",
  "src/components/Field.uf.tsx":
    'export default function Field() {\n  return <span class="field">A child</span>;\n}\n',
};

let root: string;

beforeAll(() => {
  const here = fileURLToPath(new URL("..", import.meta.url));
  mkdirSync(join(here, ".uf-tmp"), { recursive: true });
  root = mkdtempSync(join(here, ".uf-tmp", "astro-"));
  for (const [path, contents] of Object.entries(FILES)) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
  }
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

// A test run sends Astro nothing, and asks it nothing.
beforeEach(() => {
  vi.stubEnv("ASTRO_TELEMETRY_DISABLED", "1");
  vi.stubEnv("ASTRO_DISABLE_UPDATE_CHECK", "true");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** What Astro's logger prints at `warn` and below goes to stdout, so a test reads it from there. */
const captureOutput = () => {
  const printed: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    printed.push(String(chunk));
    return true;
  });
  return () => printed.join("");
};

/** What Astro's logger prints at `error` goes to stderr. */
const captureErrors = () => {
  const printed: string[] = [];
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    printed.push(String(chunk));
    return true;
  });
  return () => printed.join("");
};

/** The config of one run: no config file, no toolbar, and an output directory of its own. */
const configOf = (name: string, config: AstroInlineConfig = {}): AstroInlineConfig => ({
  root,
  configFile: false,
  outDir: `./dist-${name}`,
  devToolbar: { enabled: false },
  integrations: [unframework()],
  ...config,
});

const builtPage = (name: string) => readFileSync(join(root, `dist-${name}/index.html`), "utf8");

describe("the Astro integration", () => {
  it("is the package's ./astro entry, in source and once published", async () => {
    const entry = await import("@unframework/unplugin/astro");
    expect(entry.default).toBe(unframework);
    const manifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { publishConfig: { exports: Record<string, unknown> } };
    expect(manifest.publishConfig.exports["./astro"]).toEqual({
      types: "./dist/astro.d.ts",
      default: "./dist/astro.js",
    });
    // What publishConfig names has to be built.
    const tsdown = readFileSync(new URL("../tsdown.config.ts", import.meta.url), "utf8");
    expect(tsdown).toContain('"src/astro.ts"');
  });

  it(
    "renders a .uf.tsx component, with its child and its sheet, under astro build",
    async () => {
      const output = captureOutput();
      await build(configOf("build"));
      const html = builtPage("build");
      expect(html).toContain("Hello, Astro!");
      expect(html).toContain('<span class="field"');
      expect(html).toContain("A child");
      // Astro inlines a small sheet and minifies it.
      expect(html).toMatch(/\.card\[data-uf-\w+\]\{color:#639\}/);
      expect(output()).not.toContain("UF7010");
    },
    SLOW,
  );

  it(
    "renders a .uf.tsx component, with its child and its sheet, under an in-process astro dev",
    async () => {
      const output = captureOutput();
      const errors = captureErrors();
      // Astro's dev server adds no route handling while `VITEST` is set.
      vi.stubEnv("VITEST", "");
      const server = await dev(configOf("dev", { server: { port: 0 } }));
      try {
        const url = `http://localhost:${server.address.port}/`;
        const html = await (await fetch(url)).text();
        expect(html).toContain("Hello, Astro!");
        expect(html).toContain("A child");
        expect(html).toContain("rebeccapurple");
        expect(output()).not.toContain("UF7010");
        expect(errors()).not.toContain("dependency scan");
      } finally {
        await server.stop();
      }
    },
    SLOW,
  );

  it.each([
    ["true", true],
    ["false", false],
  ])(
    "reports UF7010 when compressHTML is %s",
    async (_name, compressHTML) => {
      const output = captureOutput();
      await build(configOf(`compress-${String(compressHTML)}`, { compressHTML }));
      expect(output()).toContain("warning[UF7010]");
      expect(output()).toContain(`compressHTML is ${String(compressHTML)}`);
      expect(builtPage(`compress-${String(compressHTML)}`)).toContain("Hello, Astro!");
    },
    SLOW,
  );

  it(
    "says nothing when compressHTML is written as its default",
    async () => {
      const output = captureOutput();
      await build(configOf("compress-jsx", { compressHTML: "jsx" }));
      expect(output()).not.toContain("UF7010");
    },
    SLOW,
  );

  it(
    "reads the final compressHTML, after every integration's setup",
    async () => {
      const output = captureOutput();
      await build(
        configOf("compress-late", {
          integrations: [
            unframework(),
            {
              name: "sets-compress-html",
              hooks: {
                "astro:config:setup": ({ updateConfig }) => {
                  updateConfig({ compressHTML: true });
                },
              },
            },
          ],
        }),
      );
      expect(output()).toContain("warning[UF7010]");
    },
    SLOW,
  );

  it(
    "hands its options to the plugin",
    async () => {
      const compiled: string[] = [];
      await build(
        configOf("options", {
          integrations: [
            unframework({
              onCompile: (event) => {
                compiled.push(`${event.target} ${event.file.slice(root.length)}`);
              },
            }),
          ],
        }),
      );
      expect(compiled).toContain("astro /src/components/Card.uf.tsx");
    },
    SLOW,
  );
});
