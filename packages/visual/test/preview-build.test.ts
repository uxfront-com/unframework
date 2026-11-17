// The static preview end to end (ADR-0111, criteria 1 to 3 of its plan): `unframework preview
// build` on the sample design system, its site served under a sub-path by a server that only maps
// URLs to files, the shell in Chromium with seven frames of the shell's origin, every example
// rendered on every target, Astro's frame as the dev preview shows it, and a changed prop that
// Astro's static frame refuses with a message. The site is built once, by the command, for the
// whole file: seven Vite builds are the cost of this file.
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { homedir, tmpdir } from "node:os";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  buildPreview,
  checkPreviewOut,
  initialProps,
  PREVIEW_MARKER,
} from "../src/preview/build.ts";
import { sameProps } from "../src/preview/frame.ts";
import { startPreview } from "../src/preview/index.ts";
import type { Preview } from "../src/preview/index.ts";
import { STATIC_RENDER_MESSAGE } from "../src/preview/protocol.ts";
import { VisualUsageError } from "../src/run.ts";

const DESIGN_SYSTEM = fileURLToPath(new URL("../../../tests/e2e/design-system", import.meta.url));
const REPOSITORY = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const TARGETS = ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"];
const EXAMPLES = ["examples/Buttons", "examples/Card", "examples/TextField"];

const require = createRequire(join(DESIGN_SYSTEM, "package.json"));
const BIN = join(
  dirname(require.resolve("@uxfront/unframework/package.json")),
  "bin/unframework.js",
);

/**
 * Runs the umbrella's bin in a directory, as a shell would, and gives its exit code and output:
 * without Vitest's `NODE_ENV`, under which Vite would build for development.
 */
function unframework(
  args: string[],
  cwd: string,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const { NODE_ENV: _test, ...env } = process.env;
  const child = spawn(process.execPath, [BIN, ...args], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => void (stdout += String(chunk)));
  child.stderr.on("data", (chunk) => void (stderr += String(chunk)));
  return new Promise((done) => child.once("exit", (code) => done({ code, stdout, stderr })));
}

function project(files: Record<string, string>): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "uf-preview-build-")));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

/**
 * A static host and nothing more: `/sub/<path>` is the file at `<dir>/<path>`, a path that ends in
 * `/` its `index.html`, and anything else 404. No rewrites, no fallback page, no server code.
 */
function fileServer(dir: string): Promise<{ url: string; server: Server }> {
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? "/", "http://host").pathname);
    const file = path.startsWith("/sub/")
      ? normalize(join(dir, path.slice("/sub/".length) || "index.html"))
      : undefined;
    const target = file && path.endsWith("/") && path !== "/sub/" ? join(file, "index.html") : file;
    if (!target || !target.startsWith(dir + sep)) {
      response.writeHead(404).end();
      return;
    }
    readFile(target).then(
      (body) => {
        response.writeHead(200, {
          "content-type": TYPES[extname(target)] ?? "application/octet-stream",
        });
        response.end(body);
      },
      () => response.writeHead(404).end(),
    );
  });
  return new Promise((done) =>
    server.listen(0, "127.0.0.1", () =>
      done({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/sub/`, server }),
    ),
  );
}

/** Every file under a directory, relative to it. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1));
}

const frame = (page: Page, target: string) =>
  page.frameLocator(`figure[data-target="${target}"] iframe`);
const status = (page: Page, target: string) =>
  page.locator(`figure[data-target="${target}"] output`);
const rootHtml = (page: Page, target: string) =>
  frame(page, target)
    .locator("[data-uf-preview-root]")
    .evaluate((root) => root.innerHTML);

describe("unframework preview build", () => {
  let out: string;
  let built: { code: number | null; stdout: string; stderr: string };
  let site: { url: string; server: Server };
  let browser: Browser;

  beforeAll(async () => {
    out = join(realpathSync(mkdtempSync(join(tmpdir(), "uf-preview-site-"))), "site");
    // The command, as a project runs it: it exits only once every render server has closed.
    const result = await unframework(["preview", "build", "--out", out], DESIGN_SYSTEM);
    built = result;
    site = await fileServer(out);
    browser = await chromium.launch();
  }, 300_000);

  afterAll(async () => {
    await browser?.close();
    await new Promise((done) => site?.server.close(done));
  });

  it("exits 0, prints where it wrote, and writes the shell, seven frames and Astro's renders", () => {
    expect(built.code, built.stderr).toBe(0);
    // Astro's render server logs to stdout too: the command's own line comes last.
    expect(built.stdout.endsWith("\n")).toBe(true);
    expect(built.stdout.trimEnd().split("\n").at(-1)).toBe(
      `unframework preview build: ${out} (${TARGETS.join(", ")})`,
    );
    const written = filesUnder(out);
    expect(written).toContain("index.html");
    expect(written).toContain(PREVIEW_MARKER);
    for (const target of TARGETS) expect(written).toContain(join(target, "frame.html"));
    expect(written.filter((file) => file.startsWith(join("astro", "renders")))).toHaveLength(
      EXAMPLES.length + 4,
    );
    // Nothing under the sources: the site, Vite's caches and Angular's `.uf-tmp/` are elsewhere.
    expect(existsSync(join(DESIGN_SYSTEM, ".unframework"))).toBe(false);
  });

  it("carries no path of this machine, and no URL from the site's root", () => {
    for (const file of filesUnder(out)) {
      const text = readFileSync(join(out, file), "utf8");
      for (const path of [REPOSITORY, homedir(), tmpdir(), realpathSync(tmpdir())]) {
        expect(text.includes(path), `${file} holds ${path}`).toBe(false);
      }
      if (file.endsWith(".html")) expect(text, file).not.toMatch(/\b(?:src|href)="\/(?!\/)/);
    }
  });

  it(
    "renders every example on seven targets under a sub-path, every frame from the shell's origin",
    { timeout: 300_000 },
    async () => {
      const page = await browser.newPage();
      await page.goto(site.url);
      const figures = page.locator("figure[data-target]");
      await expect.poll(() => figures.count()).toBe(7);
      expect(await page.locator("figcaption > span").allTextContents()).toEqual(TARGETS);
      const sources = await page
        .locator("figure[data-target] iframe")
        .evaluateAll((frames) => frames.map((each) => (each as HTMLIFrameElement).src));
      expect(sources.map((source) => new URL(source).pathname)).toEqual(
        TARGETS.map((target) => `/sub/${target}/frame.html`),
      );
      expect(new Set(sources.map((source) => new URL(source).origin))).toEqual(
        new Set([new URL(site.url).origin]),
      );
      const entries = await page
        .locator("nav button[data-entry^='example:']")
        .evaluateAll((buttons) => buttons.map((each) => (each as HTMLElement).dataset.entry));
      expect(entries).toEqual(EXAMPLES.map((id) => `example:${id}`));
      for (const id of EXAMPLES) {
        await page.locator(`nav button[data-entry="example:${id}"]`).click();
        for (const target of TARGETS) {
          await expect
            .poll(() => status(page, target).textContent(), { timeout: 60_000, message: target })
            .toBe("rendered");
          expect((await rootHtml(page, target)).trim(), `${id} on ${target}`).not.toBe("");
        }
      }
    },
  );

  it(
    "shows Astro's frame as the dev preview does, and fails it visibly on a changed prop",
    { timeout: 300_000 },
    async () => {
      const page = await browser.newPage();
      await page.goto(`${site.url}#example:examples/Buttons`);
      await expect.poll(() => status(page, "astro").textContent()).toBe("rendered");
      const fromSite = await rootHtml(page, "astro");

      let dev: Preview | undefined;
      try {
        dev = await startPreview({ root: DESIGN_SYSTEM, targets: ["astro"] });
        const devPage = await browser.newPage();
        await devPage.goto(`${dev.url}#example:examples/Buttons`);
        await expect
          .poll(() => status(devPage, "astro").textContent(), { timeout: 120_000 })
          .toBe("rendered");
        expect(fromSite).toBe(await rootHtml(devPage, "astro"));
      } finally {
        await dev?.close();
      }

      // A component starts with its initial props, which the build rendered.
      await page.locator('nav button[data-entry="component:src/Button"]').click();
      for (const target of TARGETS) {
        await expect
          .poll(() => status(page, target).textContent(), { message: target })
          .toBe("rendered");
      }
      await frame(page, "astro").locator('button[data-variant="primary"]').waitFor();
      // Other props: every target with a client runtime renders them, and Astro's frame says why
      // it can't.
      await page.getByLabel("variant").selectOption("secondary");
      for (const target of TARGETS.filter((each) => each !== "astro")) {
        await frame(page, target).locator('button[data-variant="secondary"]').waitFor();
      }
      await expect
        .poll(() => status(page, "astro").textContent())
        .toBe(`failed: ${STATIC_RENDER_MESSAGE}`);
      expect(await status(page, "astro").getAttribute("data-state")).toBe("failed");
      // Back to the initial props, which it renders again.
      await page.getByLabel("variant").selectOption("");
      await expect.poll(() => status(page, "astro").textContent()).toBe("rendered");
      await frame(page, "astro").locator('button[data-variant="primary"]').waitFor();
    },
  );

  it("exits 2 on a bad argument, and on --out at the root, above it or in a directory of others", async () => {
    const root = project({
      "unframework.config.ts": 'export default { targets: ["vue"] };\n',
      "src/Hello.uf.tsx": "export default function Hello() {\n  return <p>Hello</p>;\n}\n",
      "notes/todo.md": "Keep me.\n",
    });
    const cases: [string[], string][] = [
      [["preview", "build", "--port", "1"], "--port is the served preview's"],
      [["preview", "build", "--out", "."], "holds the project"],
      [["preview", "build", "--out", ".."], "holds the project"],
      [["preview", "build", "--out", "notes"], "is not empty and no earlier build wrote it"],
    ];
    const results = await Promise.all(cases.map(([args]) => unframework(args, root)));
    for (const [index, [args, message]] of cases.entries()) {
      expect(results[index]!.code, args.join(" ")).toBe(2);
      expect(results[index]!.stderr).toContain(message);
    }
    expect(readFileSync(join(root, "notes/todo.md"), "utf8")).toBe("Keep me.\n");
  });
});

describe("unframework preview build on an example's malformed metadata", () => {
  it("prints UF7012 on stderr and still builds, exiting 0", { timeout: 180_000 }, async () => {
    const root = fileURLToPath(new URL("fixtures/metadata", import.meta.url));
    const out = join(realpathSync(mkdtempSync(join(tmpdir(), "uf-preview-site-"))), "site");
    const result = await unframework(["preview", "build", "--target", "vue", "--out", out], root);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stderr).toMatch(/^examples\/Badge\.example\.uf\.tsx:\d+:\d+ warning UF7012: /m);
    expect(result.stdout.trimEnd().split("\n").at(-1)).toBe(
      `unframework preview build: ${out} (vue)`,
    );
    expect(existsSync(join(out, "vue", "frame.html"))).toBe(true);
  });
});

describe("buildPreview", () => {
  it("refuses an out it must not empty before it reads the project", async () => {
    const root = project({ "keep/file.txt": "x" });
    // No configuration: the refusal comes first.
    await expect(buildPreview({ root, out: "." })).rejects.toThrow(VisualUsageError);
    await expect(buildPreview({ root, out: dirname(root) })).rejects.toThrow("holds the project");
    await expect(buildPreview({ root, out: "keep" })).rejects.toThrow("is not empty");
    // A directory an earlier build wrote may be emptied, and so may an empty or missing one.
    const earlier = join(root, "earlier");
    mkdirSync(earlier);
    writeFileSync(join(earlier, PREVIEW_MARKER), "");
    writeFileSync(join(earlier, "index.html"), "");
    expect(() => checkPreviewOut(root, earlier)).not.toThrow();
    mkdirSync(join(root, "empty"));
    expect(() => checkPreviewOut(root, join(root, "empty"))).not.toThrow();
    expect(() => checkPreviewOut(root, join(root, "missing"))).not.toThrow();
    // A file is no directory to write into.
    expect(() => checkPreviewOut(root, join(root, "keep/file.txt"))).toThrow(VisualUsageError);
    expect(() => checkPreviewOut(root, join(root, "keep/file.txt"))).toThrow("is a file");
  });

  it("refuses a target the project lacks and nothing to show, and writes nothing", async () => {
    const root = project({ "unframework.config.ts": 'export default { targets: ["vue"] };\n' });
    await expect(buildPreview({ root })).rejects.toThrow("Nothing to preview");
    await expect(buildPreview({ root, targets: ["react"] })).rejects.toThrow(
      "react is not among the project's targets (vue)",
    );
    expect(existsSync(join(root, ".unframework"))).toBe(false);
  });
  it(
    "records a render that fails at build time, and its frame shows the failure",
    { timeout: 180_000 },
    async () => {
      const root = fileURLToPath(new URL("fixtures/astro-throws", import.meta.url));
      const out = join(realpathSync(mkdtempSync(join(tmpdir(), "uf-preview-site-"))), "site");
      const built = await buildPreview({ root, out });
      expect(built.targets).toEqual(["astro"]);
      const render = JSON.parse(readFileSync(join(out, "astro/renders/0.json"), "utf8")) as {
        props: unknown;
        error?: string;
        html?: string;
      };
      expect(render.props).toEqual({});
      expect(render.html).toBeUndefined();
      expect(render.error).toMatch(/length/);
      expect(render.error).not.toContain(root);

      const site = await fileServer(out);
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.goto(site.url);
        await expect
          .poll(() => status(page, "astro").textContent())
          .toBe(`failed: ${render.error}`);
      } finally {
        await browser.close();
        await new Promise((done) => site.server.close(done));
      }
    },
  );
});

const control = (name: string, optional: boolean) => ({
  name,
  optional,
  kind: "select" as const,
  options: ["a", "b"],
  initial: "a",
});

describe("initialProps", () => {
  it("gives an example none, and a component each required prop at its initial value", () => {
    expect(
      initialProps({
        examples: [
          {
            kind: "example",
            key: "example:e",
            id: "e",
            file: "/e",
            category: ["Examples"],
            title: "E",
          },
        ],
        components: [
          {
            kind: "component",
            key: "component:c",
            id: "c",
            file: "/c",
            name: "C",
            controls: [
              control("tone", false),
              control("size", true),
              { name: "on", optional: false, kind: "boolean", initial: false },
              { name: "n", optional: false, kind: "number", initial: 0 },
              { name: "label", optional: false, kind: "string", initial: "" },
            ],
            uncontrolled: [],
          },
        ],
        diagnostics: [],
      }),
    ).toEqual({ "example:e": {}, "component:c": { tone: "a", on: false, n: 0, label: "" } });
  });
});

describe("sameProps", () => {
  it("compares keys and values, in any order", () => {
    expect(sameProps({}, {})).toBe(true);
    expect(sameProps({ a: 1, b: "x" }, { b: "x", a: 1 })).toBe(true);
    expect(sameProps({ a: 1 }, { a: "1" })).toBe(false);
    expect(sameProps({ a: 1 }, {})).toBe(false);
    expect(sameProps({}, { a: undefined })).toBe(false);
    expect(sameProps({ a: false }, { b: false })).toBe(false);
  });
});
