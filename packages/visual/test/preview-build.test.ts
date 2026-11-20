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
import { readCatalogue } from "../src/preview/catalogue.ts";
import { sameProps } from "../src/preview/frame.ts";
import { projectConfig, startPreview } from "../src/preview/index.ts";
import type { Preview } from "../src/preview/index.ts";
import {
  EMBED_FILE,
  EMBED_MESSAGE,
  PREVIEW_MESSAGE,
  STATIC_RENDER_MESSAGE,
} from "../src/preview/protocol.ts";
import { VisualUsageError } from "../src/run.ts";
import {
  embedFrame,
  expectedPanel,
  expectFieldInView,
  expectFilled,
  expectNoScroll,
  fieldPlace,
  framing,
  hostPage,
  panel,
  reports,
  scrolls,
  settled,
} from "./embed-page.ts";
import { CENTRED, centred, frameLayout } from "./frame-layout.ts";

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
    expect(written).toContain(EMBED_FILE);
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
        .locator("nav [role='treeitem'][data-entry^='example:']")
        .evaluateAll((buttons) => buttons.map((each) => (each as HTMLElement).dataset.entry));
      expect(entries).toEqual(EXAMPLES.map((id) => `example:${id}`));
      for (const id of EXAMPLES) {
        await page.locator(`nav [role='treeitem'][data-entry="example:${id}"]`).click();
        for (const target of TARGETS) {
          await expect
            .poll(() => status(page, target).textContent(), { timeout: 60_000, message: target })
            .toBe("rendered");
          expect((await rootHtml(page, target)).trim(), `${id} on ${target}`).not.toBe("");
          // Centred, as in the dev preview (ADR-0114).
          const layout = await frameLayout(frame(page, target));
          expect(layout, `${id} on ${target}`).toMatchObject(CENTRED);
          if (id === "examples/Buttons") {
            expect(centred(layout), `${target}: ${JSON.stringify(layout)}`).toBe(true);
          }
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
      await page.locator(`nav [role='treeitem'][data-entry="component:src/Button"]`).click();
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

  it("answers no page of another origin that frames it and names itself the shell", async () => {
    // A page on a second origin frames the site's Vue frame, names its own origin as the shell,
    // and asks for a render: every static frame shares the shell's origin, so the frame refuses.
    const frameUrl = new URL("vue/frame.html", site.url);
    const other = createServer((_request, response) => {
      const origin = `http://127.0.0.1:${(other.address() as AddressInfo).port}`;
      frameUrl.searchParams.set("shell", origin);
      response.writeHead(200, { "content-type": "text/html" });
      response.end(
        [
          "<!doctype html>",
          `<iframe src="${frameUrl.href}"></iframe>`,
          "<script>",
          "  window.received = [];",
          "  addEventListener('message', (event) => window.received.push(event.data));",
          "</script>",
        ].join("\n"),
      );
    });
    await new Promise<void>((done) => other.listen(0, "127.0.0.1", done));
    const page = await browser.newPage();
    try {
      await page.goto(`http://127.0.0.1:${(other.address() as AddressInfo).port}/`);
      const framed = page.frameLocator("iframe");
      await expect
        .poll(() => framed.locator("body").textContent())
        .toBe("This page is a frame of unframework preview: open the preview's URL.");
      await page.evaluate(
        ([type, entry]) =>
          document
            .querySelector("iframe")!
            .contentWindow!.postMessage({ type, kind: "render", seq: 1, entry, props: {} }, "*"),
        [PREVIEW_MESSAGE, "example:examples/Buttons"],
      );
      // Nothing listens in a refused frame, so a render would have answered by now.
      await page.waitForTimeout(1000);
      expect(await framed.locator("[data-uf-preview-root], button").count()).toBe(0);
      expect(await page.evaluate(() => (window as { received?: unknown[] }).received)).toEqual([]);
    } finally {
      await page.close();
      await new Promise((done) => other.close(done));
    }
  });

  it(
    "opens an example by its own URL on each of seven targets, alone, as the shell's frame shows it",
    { timeout: 300_000 },
    async () => {
      // What the shell's frames show for the example, to compare each embed with.
      const shell = await browser.newPage();
      const expected: Record<string, string | null> = {};
      try {
        await shell.goto(`${site.url}#example:examples/Card`);
        for (const target of TARGETS) {
          await expect
            .poll(() => status(shell, target).textContent(), { timeout: 60_000, message: target })
            .toBe("rendered");
          expected[target] = await frame(shell, target)
            .locator("[data-uf-preview-root]")
            .textContent();
          expect(expected[target], target).toContain("Release notes");
        }
      } finally {
        await shell.close();
      }

      const page = await browser.newPage();
      try {
        for (const target of TARGETS) {
          await page.goto(`${site.url}${EMBED_FILE}?example=examples/Card&target=${target}`);
          // The embed page replaces itself with the target's frame, standalone: no `shell`.
          await expect
            .poll(() => new URL(page.url()).pathname, { message: target })
            .toBe(`/sub/${target}/frame.html`);
          const params = new URL(page.url()).searchParams;
          expect([...params.keys()], target).toEqual(["example"]);
          expect(params.get("example")).toBe("examples/Card");
          await expect
            .poll(() => page.locator("[data-uf-preview-root]").textContent(), {
              timeout: 60_000,
              message: target,
            })
            .toBe(expected[target]);
          expect(await page.locator("nav, figure, [data-uf-tree]").count(), target).toBe(0);
        }
        // Back skips the embed page, which replaced itself: the history holds frames only.
        await page.goBack();
        expect(new URL(page.url()).pathname).toBe(`/sub/${TARGETS.at(-2)}/frame.html`);
      } finally {
        await page.close();
      }
    },
  );

  it(
    "renders each embed in another origin's iframe, which can neither drive it nor hear from it",
    { timeout: 300_000 },
    async () => {
      // A page on a second origin frames the example on every target, records every message it
      // receives, and then asks each frame for another example, as a shell would.
      const other = createServer((_request, response) => {
        response.writeHead(200, { "content-type": "text/html" });
        response.end(
          [
            "<!doctype html>",
            "<script>",
            "  window.received = [];",
            "  addEventListener('message', (event) => window.received.push(event.data));",
            "</script>",
            ...TARGETS.map((target) => {
              const src = new URL(EMBED_FILE, site.url);
              src.searchParams.set("example", "examples/Buttons");
              src.searchParams.set("target", target);
              return `<iframe data-target="${target}" src="${src.href}"></iframe>`;
            }),
          ].join("\n"),
        );
      });
      await new Promise<void>((done) => other.listen(0, "127.0.0.1", done));
      const page = await browser.newPage();
      try {
        await page.goto(`http://127.0.0.1:${(other.address() as AddressInfo).port}/`);
        const framed = (target: string) => page.frameLocator(`iframe[data-target="${target}"]`);
        for (const target of TARGETS) {
          await framed(target)
            .getByRole("button", { name: "Save" })
            .waitFor({ timeout: 60_000 })
            .catch((error: unknown) => {
              throw new Error(`${target}: ${String(error)}`);
            });
        }
        await page.evaluate(
          ([type, entry]) => {
            for (const iframe of document.querySelectorAll("iframe")) {
              iframe.contentWindow!.postMessage(
                { type, kind: "render", seq: 1, entry, props: {} },
                "*",
              );
            }
          },
          [PREVIEW_MESSAGE, "example:examples/Card"],
        );
        // Nothing listens in a standalone frame, so a render would have answered by now.
        await page.waitForTimeout(1000);
        for (const target of TARGETS) {
          expect(await framed(target).getByRole("button", { name: "Save" }).count(), target).toBe(
            1,
          );
          expect(await framed(target).getByText("Release notes").count(), target).toBe(0);
        }
        expect(await page.evaluate(() => (window as { received?: unknown[] }).received)).toEqual(
          [],
        );
      } finally {
        await page.close();
        await new Promise((done) => other.close(done));
      }
    },
  );

  it(
    "opens an embed without its options as it did, with no panel, no mode and nothing forwarded",
    { timeout: 300_000 },
    async () => {
      const page = await browser.newPage();
      try {
        for (const target of TARGETS) {
          await page.goto(`${site.url}${EMBED_FILE}?example=examples/Buttons&target=${target}`);
          await page
            .getByRole("button", { name: "Save" })
            .waitFor({ timeout: 60_000 })
            .catch((error: unknown) => {
              throw new Error(`${target}: ${String(error)}`);
            });
          expect([...new URL(page.url()).searchParams.keys()], target).toEqual(["example"]);
          expect(await page.getByRole("region", { name: "Controls" }).count(), target).toBe(0);
          expect(await panel(page), target).toBeNull();
          expect(await page.locator("html").getAttribute("data-theme"), target).toBeNull();
          expect(await page.locator("[data-uf-embed-example], body[data-uf-embed]").count()).toBe(
            0,
          );
        }
      } finally {
        await page.close();
      }
    },
  );

  it(
    "shows an example's controls in its embed on seven targets, which render as the shell's frames",
    { timeout: 600_000 },
    async () => {
      const catalogue = await readCatalogue(
        DESIGN_SYSTEM,
        (await projectConfig(DESIGN_SYSTEM)).srcDir,
      );
      const groups = catalogue.examples.find((each) => each.id === "examples/Buttons")!.controls;
      // `Save` leaves `variant` unset, so it is live, and `Cancel` sets it (ADR-0113).
      expect(expectedPanel(groups)).toEqual([
        expect.objectContaining({ name: "Button", controls: ["variant"] }),
      ]);
      const clients = TARGETS.filter((target) => target !== "astro");

      // What the shell's frames show for each value, to compare each embed with.
      const shell = await browser.newPage();
      const shown: Record<string, Record<string, string>> = { secondary: {}, primary: {} };
      try {
        await shell.goto(`${site.url}#example:examples/Buttons`);
        for (const target of TARGETS) {
          await expect
            .poll(() => status(shell, target).textContent(), { timeout: 60_000, message: target })
            .toBe("rendered");
        }
        for (const value of ["secondary", "primary"]) {
          await shell
            .getByRole("group", { name: "Button", exact: true })
            .getByLabel("variant", { exact: true })
            .selectOption(value);
          for (const target of clients) {
            await expect
              .poll(() => status(shell, target).textContent(), { timeout: 60_000, message: target })
              .toBe("rendered");
            shown[value]![target] = await rootHtml(shell, target);
          }
        }
      } finally {
        await shell.close();
      }

      const page = await browser.newPage();
      const save = () => page.getByRole("button", { name: "Save" });
      const saveStyle = () =>
        save().evaluate((button) => {
          const style = getComputedStyle(button);
          return [style.color, style.backgroundColor, style.fontFamily];
        });
      const root = () => page.locator("[data-uf-preview-root]").evaluate((each) => each.innerHTML);
      const variant = () =>
        page.getByRole("region", { name: "Controls" }).getByLabel("variant", { exact: true });
      try {
        for (const target of TARGETS) {
          const embed = `${site.url}${EMBED_FILE}?example=examples/Buttons&target=${target}`;
          await page.goto(embed);
          await save().waitFor({ timeout: 60_000 });
          const plain = { html: await root(), style: await saveStyle() };

          await page.goto(`${embed}&controls=true`);
          await save().waitFor({ timeout: 60_000 });
          const params = new URL(page.url()).searchParams;
          expect([...params.entries()], target).toEqual([
            ["example", "examples/Buttons"],
            ["controls", "true"],
          ]);
          await expect(page.getByRole("region", { name: "Controls" }).count()).resolves.toBe(1);
          expect(await panel(page), target).toEqual(expectedPanel(groups));
          // The panel changes nothing of the example: its DOM, nor the styles it renders with.
          expect(await root(), target).toBe(plain.html);
          expect(await saveStyle(), target).toEqual(plain.style);

          if (target === "astro") {
            // Astro's static frame renders only what the build rendered: the panel stays, and
            // the area says why (ADR-0111).
            await variant().selectOption("secondary");
            const failure = page.locator("[data-uf-embed-failure]");
            await expect.poll(() => failure.textContent()).toBe(STATIC_RENDER_MESSAGE);
            await expect.poll(() => save().count()).toBe(0);
            await expect(variant().isVisible()).resolves.toBe(true);
            await variant().selectOption("");
            await expect.poll(() => failure.count()).toBe(0);
            await expect.poll(root).toBe(plain.html);
            continue;
          }
          for (const value of ["secondary", "primary"]) {
            await variant().selectOption(value);
            await expect
              .poll(root, { timeout: 30_000, message: `${value} on ${target}` })
              .toBe(shown[value]![target]);
          }
          // `Cancel` sets its own variant, which no control overrides (UXF-874).
          await expect
            .poll(() => page.getByRole("button", { name: "Cancel" }).getAttribute("data-variant"))
            .toBe("secondary");
          await variant().selectOption("");
          await expect.poll(root, { message: `default on ${target}` }).toBe(plain.html);
        }
      } finally {
        await page.close();
      }
    },
  );

  it(
    "keeps the panel and its first field in view in an iframe of a fixed height",
    { timeout: 300_000 },
    async () => {
      const host = await hostPage();
      const page = await browser.newPage();
      try {
        for (const target of ["vue", "astro"]) {
          // 300 px, then no height at all: an iframe's default, 150 px.
          for (const height of [300, undefined]) {
            const src = `${site.url}${EMBED_FILE}?example=examples/Buttons&target=${target}&controls=true`;
            host.set(framing(src, height));
            await page.goto(host.url);
            const frame = page.frameLocator("#embed");
            await frame.getByRole("button", { name: "Save" }).waitFor({ timeout: 60_000 });
            const place = await fieldPlace(frame);
            const at = `${target} at ${height ?? "default"}: ${JSON.stringify(place)}`;
            expect(place.innerHeight, at).toBe(height ?? 150);
            expectFieldInView(place, at);
            expectFilled(place, at);
          }
        }
        expect(await reports(page)).toEqual([]);
      } finally {
        await page.close();
        await host.close();
      }
    },
  );

  it(
    "sets the colour mode from the URL, and takes it only from the parent, in place",
    { timeout: 300_000 },
    async () => {
      const page = await browser.newPage();
      const host = await hostPage();
      try {
        await page.goto(`${site.url}${EMBED_FILE}?example=examples/Buttons&target=vue&theme=dark`);
        await page.getByRole("button", { name: "Save" }).waitFor({ timeout: 60_000 });
        expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
        expect(
          await page.locator("html").evaluate((html) => getComputedStyle(html).colorScheme),
        ).toBe("dark");

        // A host on another origin, an embed that asked for the message, one that didn't, and a
        // frame of the host's own that posts to the embed, which is not the embed's parent.
        const embed = (query: string) =>
          `${site.url}${EMBED_FILE}?example=examples/Buttons&target=vue${query}`;
        host.set(
          [
            framing(embed("&theme=light&controls=true")),
            `<iframe id="plain" src="${embed("")}"></iframe>`,
            `<iframe id="sibling" srcdoc="<script>window.post = (data) => parent.document.getElementById('embed').contentWindow.postMessage(data, '*');</script>"></iframe>`,
          ].join("\n"),
        );
        await page.goto(host.url);
        const frame = page.frameLocator("#embed");
        const plain = page.frameLocator("#plain");
        await frame.getByRole("button", { name: "Save" }).waitFor({ timeout: 60_000 });
        await plain.getByRole("button", { name: "Save" }).waitFor({ timeout: 60_000 });
        const theme = () => frame.locator("html").getAttribute("data-theme");
        await frame
          .getByRole("region", { name: "Controls" })
          .getByLabel("variant", { exact: true })
          .selectOption("secondary");
        await expect
          .poll(() => frame.getByRole("button", { name: "Save" }).getAttribute("data-variant"))
          .toBe("secondary");
        await frame.locator("html").evaluate(() => {
          (window as { loaded?: boolean }).loaded = true;
        });
        expect(await theme()).toBe("light");

        const post = (id: string, data: unknown) =>
          page.evaluate(
            ([id, data]) =>
              (document.getElementById(id) as HTMLIFrameElement).contentWindow!.postMessage(
                data,
                "*",
              ),
            [id, data] as const,
          );
        await post("embed", {
          type: PREVIEW_MESSAGE,
          kind: "render",
          seq: 1,
          entry: "x",
          props: {},
        });
        await post("embed", { type: EMBED_MESSAGE, kind: "theme", theme: "blue" });
        await page
          .frameLocator("#sibling")
          .locator("html")
          .evaluate((_html, data) => (window as { post?: (data: unknown) => void }).post!(data), {
            type: EMBED_MESSAGE,
            kind: "theme",
            theme: "dark",
          });
        await post("plain", { type: EMBED_MESSAGE, kind: "theme", theme: "dark" });
        await page.waitForTimeout(500);
        expect(await theme()).toBe("light");
        expect(await plain.locator("html").getAttribute("data-theme")).toBeNull();

        await post("embed", { type: EMBED_MESSAGE, kind: "theme", theme: "dark" });
        await expect.poll(theme).toBe("dark");
        expect(
          await frame.locator("html").evaluate((html) => ({
            scheme: getComputedStyle(html).colorScheme,
            loaded: (window as { loaded?: boolean }).loaded,
          })),
        ).toEqual({ scheme: "dark", loaded: true });
        expect(await frame.getByRole("button", { name: "Save" }).getAttribute("data-variant")).toBe(
          "secondary",
        );
        expect(
          await frame
            .getByRole("region", { name: "Controls" })
            .getByLabel("variant", { exact: true })
            .inputValue(),
        ).toBe("secondary");
        // Nothing reports a height, since neither embed asked to.
        expect(await reports(page)).toEqual([]);
      } finally {
        await page.close();
        await host.close();
      }
    },
  );

  it(
    "reports a height the host can apply, with and without controls, that settles and shrinks",
    { timeout: 300_000 },
    async () => {
      const host = await hostPage();
      const page = await browser.newPage();
      try {
        for (const target of ["vue", "astro"]) {
          for (const query of ["&resize=true", "&resize=true&controls=true"]) {
            const src = `${site.url}${EMBED_FILE}?example=examples/Buttons&target=${target}${query}`;
            host.set(framing(src, 1000));
            await page.goto(host.url);
            await page
              .frameLocator("#embed")
              .getByRole("button", { name: "Save" })
              .waitFor({ timeout: 60_000 });
            const at = `${target}${query}`;
            const height = await settled(page, at);
            expect(height, at).toBeLessThan(1000);
            const frame = await embedFrame(page);
            await expect
              .poll(() => frame.evaluate(() => innerHeight), { message: at })
              .toBe(height);
            const boxes = await scrolls(frame);
            expectNoScroll(boxes, `${at}: ${JSON.stringify(boxes)}`);
            if (query.includes("controls")) {
              expect(boxes.panel, at).not.toBeNull();
              expectFieldInView(await fieldPlace(frame), at);
            } else {
              // The example's own height, not the container's `min-height: 100%` of the frame's.
              expect(height, `${at}: ${JSON.stringify(boxes)}`).toBeLessThanOrEqual(
                Math.ceil(boxes.example) + 2,
              );
            }
          }
        }
      } finally {
        await page.close();
        await host.close();
      }
    },
  );

  it("says why on a missing or unknown example or target, never a blank page", async () => {
    const targets = TARGETS.join(", ");
    const usage = `Open an example with embed.html?example=<id>&target=<target>. The targets are ${targets}.`;
    const cases: [path: string, message: string, stays: string][] = [
      [`${EMBED_FILE}?example=nope&target=vue`, 'This preview has no example "nope".', EMBED_FILE],
      [
        `${EMBED_FILE}?example=examples/Card&target=nope`,
        `This preview has no target "nope". Its targets are ${targets}.`,
        EMBED_FILE,
      ],
      [EMBED_FILE, usage, EMBED_FILE],
      [`${EMBED_FILE}?example=examples/Card`, usage, EMBED_FILE],
      [`${EMBED_FILE}?target=vue`, usage, EMBED_FILE],
      // A frame opened alone on an id it lacks, through a client runtime and a static render.
      ["vue/frame.html?example=nope", 'This preview has no example "nope".', "vue/frame.html"],
      ["astro/frame.html?example=nope", 'This preview has no example "nope".', "astro/frame.html"],
      // A component takes props, which an embed has none of: the frame opens examples only.
      [
        "vue/frame.html?example=src/Button",
        'This preview has no example "src/Button".',
        "vue/frame.html",
      ],
      // An option with a value it doesn't take, on the embed page and on a frame (ADR-0116).
      ...[
        ["controls=yes", 'The controls parameter takes true, not "yes".'],
        ["theme=blue", 'The theme parameter takes light or dark, not "blue".'],
        ["resize=1", 'The resize parameter takes true, not "1".'],
      ].flatMap(([query, message]): [string, string, string][] => [
        [`${EMBED_FILE}?example=examples/Card&target=vue&${query}`, message!, EMBED_FILE],
        [`vue/frame.html?example=examples/Card&${query}`, message!, "vue/frame.html"],
        [`astro/frame.html?example=examples/Card&${query}`, message!, "astro/frame.html"],
      ]),
    ];
    const page = await browser.newPage();
    try {
      for (const [path, message, stays] of cases) {
        await page.goto(`${site.url}${path}`);
        // The page's own markup after its script leaves a line break: the message is the text.
        await expect
          .poll(async () => (await page.locator("body").textContent())?.trim(), { message: path })
          .toBe(message);
        expect(new URL(page.url()).pathname, path).toBe(`/sub/${stays}`);
        expect(await page.locator("[data-uf-preview-root]").count(), path).toBe(0);
      }
    } finally {
      await page.close();
    }
  });

  // Each of the four processes loads the visual package's CLI entry, and so Vitest's Node API,
  // before it reads its arguments. Four cold starts at once take seconds on a loaded runner, as in
  // `packages/unframework/test/cli.test.ts`.
  it(
    "exits 2 on a bad argument, and on --out at the root, above it or in a directory of others",
    { timeout: 60_000 },
    async () => {
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
    },
  );
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

describe("buildPreview of an example's controls", () => {
  it(
    "applies them on every target with a client runtime, and Astro's frame says it can't",
    { timeout: 600_000 },
    async () => {
      const root = fileURLToPath(new URL("fixtures/example-controls", import.meta.url));
      const out = join(realpathSync(mkdtempSync(join(tmpdir(), "uf-preview-site-"))), "site");
      const built = await buildPreview({ root, out });
      const targets = built.targets.map(String);
      expect(targets).toEqual([
        "react",
        "vue",
        "svelte",
        "solid",
        "solid2",
        "angular",
        "qwik",
        "astro",
      ]);
      const site = await fileServer(out);
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.goto(`${site.url}#example:examples/Flags`);
        const tone = (target: string, label: string) =>
          frame(page, target).locator(`[data-flag="${label}"]`).getAttribute("data-tone");
        // As written, Astro's build-time render included.
        for (const target of targets) {
          await expect
            .poll(() => status(page, target).textContent(), { timeout: 60_000, message: target })
            .toBe("rendered");
          expect(await tone(target, "bare"), target).toBe("info");
        }
        const flagTone = page
          .getByRole("group", { name: "Flag", exact: true })
          .getByLabel("tone", { exact: true });
        await flagTone.selectOption("error");
        for (const target of targets.filter((each) => each !== "astro")) {
          await expect.poll(() => tone(target, "bare"), { message: target }).toBe("error");
          await expect.poll(() => tone(target, "nested"), { message: target }).toBe("error");
          expect(await tone(target, "warned"), target).toBe("warn");
        }
        await expect
          .poll(() => status(page, "astro").textContent())
          .toBe(`failed: ${STATIC_RENDER_MESSAGE}`);
        // Every control back at "(default)": the props it was built with, which it renders.
        await flagTone.selectOption("");
        await expect.poll(() => status(page, "astro").textContent()).toBe("rendered");
        expect(await tone("astro", "bare")).toBe("info");
      } finally {
        await browser.close();
        await new Promise((done) => site.server.close(done));
      }
    },
  );
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
            controls: [],
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
