// The preview end to end (ADR-0088, checks P5.1 and P5.2 of the M7 plan): `startPreview` on the
// sample design system, its shell in Chromium with seven frames of seven origins, a control that
// reaches every frame, and nothing left listening after `close()` or after the command's SIGINT.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { connect, createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { describe, expect, it } from "vitest";

import { startPreview } from "../src/preview/index.ts";
import { FRAME_PATH, RENDER_PATH } from "../src/preview/protocol.ts";
import { PREVIEW_HOST } from "../src/preview/servers.ts";
import { VisualUsageError } from "../src/run.ts";

const DESIGN_SYSTEM = fileURLToPath(new URL("../../../tests/e2e/design-system", import.meta.url));
const TARGETS = ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"];

/** Whether something accepts a connection on the port. */
function listening(port: number): Promise<boolean> {
  return new Promise((done) => {
    const socket = connect({ host: PREVIEW_HOST, port });
    socket.once("connect", () => {
      socket.destroy();
      done(true);
    });
    socket.once("error", () => done(false));
  });
}

/** A port nothing listens on, as the system gives it. */
function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const server = createServer();
    server.once("error", fail);
    server.listen(0, PREVIEW_HOST, () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => done(port));
    });
  });
}

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "uf-preview-"));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

/** How many TCP servers this process holds open. */
const servers = (): number =>
  process.getActiveResourcesInfo().filter((each) => each === "TCPServerWrap").length;

describe("startPreview", () => {
  it(
    "shows an example and a component on seven targets, from seven origins, and stops every server",
    { timeout: 300_000 },
    async () => {
      const preview = await startPreview({ root: DESIGN_SYSTEM });
      const ports = [Number(new URL(preview.url).port), ...preview.frames.map((each) => each.port)];
      const browser = await chromium.launch();
      try {
        expect(preview.frames.map((each) => each.target)).toEqual(TARGETS);
        const page = await browser.newPage();
        await page.goto(preview.url);
        const figures = page.locator("figure[data-target]");
        await expect.poll(() => figures.count()).toBe(7);
        const sources = await page
          .locator("figure[data-target] iframe")
          .evaluateAll((frames) => frames.map((frame) => (frame as HTMLIFrameElement).src));
        const origins = new Set(sources.map((source) => new URL(source).origin));
        expect(origins.size).toBe(7);
        expect([...origins]).toEqual(preview.frames.map((each) => each.origin));
        expect(await page.locator("figcaption > span").allTextContents()).toEqual(TARGETS);

        const frame = (target: string) =>
          page.frameLocator(`figure[data-target="${target}"] iframe`);
        const status = (target: string) => page.locator(`figure[data-target="${target}"] output`);
        // The first example is selected: its text shows in every frame, Astro's included.
        for (const target of TARGETS) {
          await frame(target).getByRole("button", { name: "Save" }).waitFor({ timeout: 120_000 });
          await expect
            .poll(() => status(target).textContent(), { timeout: 30_000 })
            .toBe("rendered");
        }

        await page.getByRole("button", { name: "src/Button", exact: true }).click();
        const variant = page.getByLabel("variant");
        await variant.selectOption("primary");
        for (const target of TARGETS) {
          await frame(target).locator('button[data-variant="primary"]').waitFor();
        }
        await variant.selectOption("secondary");
        for (const target of TARGETS) {
          await frame(target).locator('button[data-variant="secondary"]').waitFor();
          expect(await frame(target).locator("button[data-variant]").count(), target).toBe(1);
          await expect.poll(() => status(target).textContent()).toBe("rendered");
        }
        // Back to its default: the prop is left out, and every target applies its own default.
        await variant.selectOption("");
        for (const target of TARGETS) {
          await frame(target).locator('button[data-variant="primary"]').waitFor();
        }

        // The render endpoint takes only the frame's JSON POST.
        const astro = preview.frames.find((each) => each.target === "astro")!.origin;
        expect((await fetch(`${astro}${RENDER_PATH}`)).status).toBe(405);
        const plain = await fetch(`${astro}${RENDER_PATH}`, { method: "POST", body: "{}" });
        expect(plain.status).toBe(405);
        const unknown = await fetch(`${astro}${RENDER_PATH}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: "/nowhere.uf.tsx.astro", props: {} }),
        });
        expect(unknown.status).toBe(500);
        const huge = await fetch(`${astro}${RENDER_PATH}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: "x", props: { text: "x".repeat(2_000_000) } }),
        }).catch((error: unknown) => error);
        // The server answers 413 and drops the rest of the body, which a client may see as a reset.
        if (huge instanceof Response) expect(huge.status).toBe(413);
        else expect(huge).toBeInstanceOf(TypeError);
        expect((await fetch(`${astro}${FRAME_PATH}`)).status).toBe(200);
        // A target with a client runtime has no render endpoint.
        const react = preview.frames.find((each) => each.target === "react")!.origin;
        expect((await fetch(`${react}${RENDER_PATH}`, { method: "POST" })).status).toBe(404);
        const alone = await (await fetch(`${react}${FRAME_PATH}`)).text();
        expect(alone).toContain("data-uf-preview-root");
        expect((await fetch(`${preview.url}catalogue.json`)).status).toBe(404);
      } finally {
        await browser.close();
        await preview.close();
      }
      for (const port of ports) expect(await listening(port), String(port)).toBe(false);
      // A second close does nothing more.
      await preview.close();
    },
  );

  it(
    "shows an example kept beside its component apart from the component",
    { timeout: 180_000 },
    async () => {
      const root = fileURLToPath(new URL("fixtures/beside", import.meta.url));
      const preview = await startPreview({ root });
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        // The example is the page's first entry, and its key names it in the URL.
        await page.goto(preview.url);
        await expect.poll(() => page.evaluate(() => location.hash)).toBe("#example:src/Card");
        const nav = page.getByRole("navigation");
        const current = nav.locator('button[aria-current="true"]');
        await expect.poll(() => current.count()).toBe(1);
        expect(await current.getAttribute("data-entry")).toBe("example:src/Card");
        for (const { target } of preview.frames) {
          const frame = page.frameLocator(`figure[data-target="${target}"] iframe`);
          await frame.getByText("Release notes").waitFor({ timeout: 120_000 });
        }
        // The component under the same id renders with no content.
        await nav.getByRole("listitem").nth(1).getByRole("button", { name: "src/Card" }).click();
        await expect.poll(() => current.count()).toBe(1);
        expect(await current.getAttribute("data-entry")).toBe("component:src/Card");
        for (const { target } of preview.frames) {
          const frame = page.frameLocator(`figure[data-target="${target}"] iframe`);
          await frame.locator("article.card").waitFor({ state: "attached" });
          await expect.poll(() => frame.getByText("Release notes").count()).toBe(0);
        }
        // A link to the example shows it again.
        await page.goto(`${preview.url}#example:src/Card`);
        expect(await current.getAttribute("data-entry")).toBe("example:src/Card");
        for (const { target } of preview.frames) {
          const frame = page.frameLocator(`figure[data-target="${target}"] iframe`);
          await frame.getByText("Release notes").waitFor();
        }
      } finally {
        await browser.close();
        await preview.close();
      }
    },
  );

  it("refuses a target the project lacks, a port that is not one, and nothing to show", async () => {
    const root = project({ "unframework.config.ts": 'export default { targets: ["vue"] };\n' });
    await expect(startPreview({ root })).rejects.toThrow("Nothing to preview");
    await expect(startPreview({ root, targets: ["react"] })).rejects.toThrow(
      "react is not among the project's targets (vue)",
    );
    await expect(startPreview({ root, port: 70_000 })).rejects.toThrow(VisualUsageError);
    await expect(startPreview({ root, port: 1.5 })).rejects.toThrow("whole number");
  });

  it(
    "closes the servers it started when the shell's port is taken",
    { timeout: 120_000 },
    async () => {
      const root = project({
        "unframework.config.ts": 'export default { targets: ["vue", "react"] };\n',
        "src/Hello.uf.tsx": "export default function Hello() {\n  return <p>Hello</p>;\n}\n",
      });
      const taken = createServer();
      await new Promise<void>((done) => taken.listen(0, PREVIEW_HOST, done));
      const port = (taken.address() as AddressInfo).port;
      const before = servers();
      try {
        await expect(startPreview({ root, port })).rejects.toThrow("EADDRINUSE");
        // A closed server's handle goes once its socket has closed, just after `close()` resolves.
        await expect.poll(servers, { timeout: 5_000 }).toBe(before);
      } finally {
        await new Promise((done) => taken.close(done));
      }
    },
  );
});

describe("unframework preview", () => {
  it(
    "prints the URL, serves until SIGINT, then closes every server and exits 0",
    { timeout: 180_000 },
    async () => {
      const port = await freePort();
      const require = createRequire(join(DESIGN_SYSTEM, "package.json"));
      const bin = join(
        dirname(require.resolve("@uxfront/unframework/package.json")),
        "bin/unframework.js",
      );
      const child = spawn(process.execPath, [bin, "preview", "--port", String(port)], {
        cwd: DESIGN_SYSTEM,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stderr.on("data", (chunk) => void (stderr += String(chunk)));
      const exited = new Promise<number | null>((done) => child.once("exit", (code) => done(code)));
      try {
        await new Promise<void>((done, fail) => {
          child.stdout.on("data", (chunk) => {
            stdout += String(chunk);
            if (stdout.includes("Press Ctrl+C to stop.")) done();
          });
          void exited.then((code) => fail(new Error(`exited with ${code}:\n${stdout}\n${stderr}`)));
        });
        expect(stdout).toContain(`unframework preview: http://${PREVIEW_HOST}:${port}/`);
        const origins = [...stdout.matchAll(/^ {2}(\w+): (http:\/\/\S+)$/gm)];
        expect(origins.map((match) => match[1])).toEqual(TARGETS);
        const ports = [port, ...origins.map((match) => Number(new URL(match[2]!).port))];
        for (const each of ports) expect(await listening(each), String(each)).toBe(true);
        const page = await fetch(`http://${PREVIEW_HOST}:${port}/`);
        expect(await page.text()).toContain("<title>unframework preview</title>");

        child.kill("SIGINT");
        expect(await exited, stderr).toBe(0);
        expect(stdout).toContain("unframework preview: stopped.");
        for (const each of ports) expect(await listening(each), String(each)).toBe(false);
      } finally {
        if (child.exitCode === null) child.kill("SIGKILL");
      }
    },
  );
});
