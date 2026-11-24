// The preview end to end (ADR-0088, checks P5.1 and P5.2 of the M7 plan): `startPreview` on the
// sample design system, its shell in Chromium with seven frames of seven origins, a control that
// reaches every frame, and nothing left listening after `close()` or after the command's SIGINT.
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { connect, createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import type { TargetName } from "@unframework.dev/compiler";
import { normalizeHtml } from "@unframework.dev/testing/normalize";
import { chromium } from "playwright";
import type { FrameLocator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { readCatalogue } from "../src/preview/catalogue.ts";
import { preview } from "../src/preview/command.ts";
import { projectConfig, startPreview, targetServerOptions } from "../src/preview/index.ts";
import { exampleTransform } from "../src/preview/instrument.ts";
import { EMBED_FILE, FRAME_PATH, RENDER_PATH } from "../src/preview/protocol.ts";
import { PREVIEW_HOST, startTargetServer } from "../src/preview/servers.ts";
import { shellData, shellPage, startShellServer } from "../src/preview/shell.ts";
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
  scrolls,
  settled,
} from "./embed-page.ts";
import { CENTRED, centred, frameLayout } from "./frame-layout.ts";

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

const EXAMPLE_CONTROLS = fileURLToPath(new URL("fixtures/example-controls", import.meta.url));
const EMBED = fileURLToPath(new URL("fixtures/embed", import.meta.url));
const REPOSITORY = fileURLToPath(new URL("../../..", import.meta.url));
/** The fixture's eight targets, as the preview names them. */
const EIGHT = ["react", "vue", "svelte", "solid", "solid2", "angular", "qwik", "astro"];

/**
 * A copy of the example controls' fixture, for a test that edits it, beside the fixtures, so its
 * frameworks resolve as theirs do, with where each compiler stack resolves from (A9).
 */
function fixtureCopy(): { root: string; toolchainDirs: Partial<Record<TargetName, string>> } {
  const parent = fileURLToPath(new URL("fixtures/.uf-tmp", import.meta.url));
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, "example-controls-"));
  cpSync(EXAMPLE_CONTROLS, root, { recursive: true });
  const toolchain = (name: string) => relative(root, join(REPOSITORY, "tests/toolchains", name));
  return {
    root,
    toolchainDirs: {
      angular: toolchain("angular"),
      vue: toolchain("vue"),
      svelte: toolchain("svelte"),
      solid2: toolchain("solid2"),
    },
  };
}

/** A frame's root, normalised as the harness normalises a target's DOM (ADR-0031). */
async function frameRoot(page: Page, target: string): Promise<string> {
  const html = await page
    .frameLocator(`figure[data-target="${target}"] iframe`)
    .locator("[data-uf-preview-root]")
    .innerHTML();
  return normalizeHtml(html, { target: target as "react" });
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
          // An example without `@layout` sits at the centre of its frame (ADR-0114).
          const layout = await frameLayout(frame(target));
          expect(layout, target).toMatchObject(CENTRED);
          expect(centred(layout), `${target}: ${JSON.stringify(layout)}`).toBe(true);
        }

        await page.getByRole("treeitem", { name: "src/Button", exact: true }).click();
        const variant = page.getByLabel("variant");
        await variant.selectOption("primary");
        for (const target of TARGETS) {
          // The example's Save is `primary` too: the frame has the component once it rendered the
          // last change and shows its one button.
          await expect
            .poll(() => status(target).textContent(), { timeout: 30_000, message: target })
            .toBe("rendered");
          await expect.poll(() => frame(target).locator("button[data-variant]").count()).toBe(1);
          await frame(target).locator('button[data-variant="primary"]').waitFor();
          // A component takes the same centred layout.
          const layout = await frameLayout(frame(target));
          expect(layout, target).toMatchObject(CENTRED);
          expect(centred(layout), `${target}: ${JSON.stringify(layout)}`).toBe(true);
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
        if (huge instanceof Response) {
          expect(huge.status).toBe(413);
        } else {
          expect(huge).toBeInstanceOf(TypeError);
        }
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
      for (const port of ports) {
        expect(await listening(port), String(port)).toBe(false);
      }
      // A second close does nothing more.
      await preview.close();
    },
  );

  it(
    "opens an example by its own URL on each of seven targets' servers (ADR-0112)",
    { timeout: 300_000 },
    async () => {
      const preview = await startPreview({ root: DESIGN_SYSTEM });
      const browser = await chromium.launch();
      try {
        const embed = await fetch(`${preview.url}${EMBED_FILE}`);
        expect(embed.status).toBe(200);
        expect(embed.headers.get("content-type")).toBe("text/html; charset=utf-8");
        const head = await fetch(`${preview.url}${EMBED_FILE}`, { method: "HEAD" });
        expect(head.status).toBe(200);
        expect((await fetch(`${preview.url}other`)).status).toBe(404);
        expect((await fetch(`${preview.url}${EMBED_FILE}`, { method: "POST" })).status).toBe(404);

        const page = await browser.newPage();
        for (const { target, origin } of preview.frames) {
          await page.goto(`${preview.url}${EMBED_FILE}?example=examples/Card&target=${target}`);
          // The embed page on the shell's server sends the browser to the target's own server.
          await expect
            .poll(() => new URL(page.url()).origin + new URL(page.url()).pathname, {
              message: target,
            })
            .toBe(`${origin}${FRAME_PATH}`);
          const params = new URL(page.url()).searchParams;
          expect([...params.keys()], target).toEqual(["example"]);
          expect(params.get("example")).toBe("examples/Card");
          await page.getByText("Release notes").waitFor({ timeout: 120_000 });
          expect(await page.locator("nav, figure, [data-uf-tree]").count(), target).toBe(0);
        }
      } finally {
        await browser.close();
        await preview.close();
      }
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
        const current = nav.locator('[role="treeitem"][aria-selected="true"]');
        await expect.poll(() => current.count()).toBe(1);
        expect(await current.getAttribute("data-entry")).toBe("example:src/Card");
        for (const { target } of preview.frames) {
          const frame = page.frameLocator(`figure[data-target="${target}"] iframe`);
          await frame.getByText("Release notes").waitFor({ timeout: 120_000 });
        }
        // The component under the same id renders with no content.
        await nav
          .getByRole("tree", { name: "Components" })
          .getByRole("treeitem", { name: "src/Card" })
          .click();
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

  it(
    "lays out each example as its @layout says, and carries nothing over to the next",
    { timeout: 180_000 },
    async () => {
      const root = fileURLToPath(new URL("fixtures/layouts", import.meta.url));
      const preview = await startPreview({ root });
      const browser = await chromium.launch();
      const targets = preview.frames.map((each) => each.target);
      try {
        expect(targets).toEqual(["vue", "angular", "qwik", "astro"]);
        // The malformed value is a warning, and its example still renders, centred.
        expect(preview.diagnostics.map((each) => [each.code, each.file])).toEqual([
          ["UF7012", "examples/Broken.example.uf.tsx"],
        ]);
        const page = await browser.newPage();
        await page.goto(preview.url);
        const frame = (target: string) =>
          page.frameLocator(`figure[data-target="${target}"] iframe`);
        const status = (target: string) => page.locator(`figure[data-target="${target}"] output`);
        const centredFlex = { ...CENTRED, gap: "0px", paddingTop: "16px" };
        const expected: Record<string, Record<string, unknown>> = {
          Column: {
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "safe flex-end",
            flexWrap: "wrap",
            // A bare `gap` is the scale's middle, `1rem`.
            gap: "16px",
            paddingTop: "16px",
          },
          Default: centredFlex,
          Plain: { display: "block", paddingTop: "0px" },
          Broken: centredFlex,
        };
        for (const name of ["Column", "Default", "Plain", "Column", "Broken"]) {
          await page
            .locator(`nav [role='treeitem'][data-entry="example:examples/${name}"]`)
            .click();
          for (const target of targets) {
            await frame(target).getByText("Two").waitFor({ timeout: 120_000 });
            await expect
              .poll(() => status(target).textContent(), { timeout: 60_000, message: target })
              .toBe("rendered");
            await expect
              .poll(() => frameLayout(frame(target)), { message: `${name} on ${target}` })
              .toMatchObject(expected[name]!);
            const layout = await frameLayout(frame(target));
            const at = `${name} on ${target}: ${JSON.stringify(layout)}`;
            if (name === "Plain") {
              expect(layout.height, at).toBe(layout.innerHeight);
            }
            if (name === "Default" || name === "Broken") {
              expect(centred(layout), at).toBe(true);
            }
            if (name === "Column") {
              const [one, two] = await Promise.all(
                ["One", "Two"].map((text) =>
                  frame(target)
                    .getByText(text, { exact: true })
                    .evaluate((span) => {
                      const { top, bottom } = span.getBoundingClientRect();
                      return { top, bottom };
                    }),
                ),
              );
              expect(Math.abs(two!.top - one!.bottom - 16), at).toBeLessThanOrEqual(0.5);
            }
            // The frame styles its container alone: the example's own elements keep the styles
            // their output writes, which is none but Angular's host (ADR-0010).
            const styled = await frame(target)
              .locator("[data-uf-preview-root]")
              .evaluate((container) =>
                [...container.querySelectorAll("[style]")].map((each) => [
                  each.localName,
                  each.getAttribute("style"),
                ]),
              );
            if (target === "angular") {
              expect(styled.length, at).toBe(1);
              expect(styled[0]![0], at).toContain("-");
              expect(styled[0]![1], at).toMatch(/^display: contents;?$/);
            } else {
              expect(styled, at).toEqual([]);
            }
          }
        }
        // An example opened by its own URL, with no shell, takes its layout too (ADR-0112).
        const alone = await browser.newPage();
        for (const { target } of preview.frames) {
          await alone.goto(`${preview.url}${EMBED_FILE}?example=examples/Column&target=${target}`);
          await alone.getByText("Two").waitFor({ timeout: 120_000 });
          await expect
            .poll(() => frameLayout(alone), { message: `standalone Column on ${target}` })
            .toMatchObject(expected.Column!);
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
      await new Promise<void>((done) => {
        taken.listen(0, PREVIEW_HOST, done);
      });
      const port = (taken.address() as AddressInfo).port;
      const before = servers();
      try {
        await expect(startPreview({ root, port })).rejects.toThrow("EADDRINUSE");
        // A closed server's handle goes once its socket has closed, just after `close()` resolves.
        await expect.poll(servers, { timeout: 5000 }).toBe(before);
      } finally {
        await new Promise((done) => {
          taken.close(done);
        });
      }
    },
  );
});

describe("an example's controls", () => {
  it(
    "reach every instance that leaves the prop unset, on eight targets, and no other component's",
    { timeout: 600_000 },
    async () => {
      const { root, toolchainDirs } = fixtureCopy();
      const example = join(root, "examples/Flags.example.uf.tsx");
      const written = readFileSync(example, "utf8");
      const preview = await startPreview({ root, toolchainDirs });
      const browser = await chromium.launch();
      try {
        expect(preview.frames.map((each) => each.target)).toEqual(EIGHT);
        const page = await browser.newPage();
        await page.goto(preview.url);
        const frame = (target: string): FrameLocator =>
          page.frameLocator(`figure[data-target="${target}"] iframe`);
        const status = (target: string) => page.locator(`figure[data-target="${target}"] output`);
        const flag = (target: string, label: string) =>
          frame(target).locator(`[data-flag="${label}"]`);
        const badge = (target: string, text: string) =>
          frame(target).locator(`[data-badge="${text}"]`);
        const control = (group: string, name: string) =>
          page.getByRole("group", { name: group, exact: true }).getByLabel(name, { exact: true });
        /** Waits until every frame has rendered the last change, then checks each. */
        const each = async (check: (target: string) => Promise<void>) => {
          for (const target of EIGHT) {
            await expect
              .poll(() => status(target).textContent(), { timeout: 60_000 })
              .toBe("rendered");
            await check(target);
          }
        };
        const attribute = (locator: ReturnType<typeof flag>, name: string) =>
          expect.poll(() => locator.getAttribute(name), {
            timeout: 30_000,
            message: `${String(locator)} ${name}`,
          });

        // The example as written, on every frame.
        for (const target of EIGHT) {
          await flag(target, "bare").waitFor({ timeout: 180_000 });
        }
        const written_ = new Map<string, string>();
        await each(async (target) => {
          await attribute(flag(target, "bare"), "data-tone").toBe("info");
          written_.set(target, await frameRoot(page, target));
        });

        // Flag's tone alone: every unset Flag, nested too, and no Badge.
        await control("Flag", "tone").selectOption("error");
        await each(async (target) => {
          for (const label of ["bare", "nested"]) {
            await attribute(flag(target, label), "data-tone").toBe("error");
          }
          await attribute(flag(target, "warned"), "data-tone").toBe("warn");
          // The `<component is>` is not an instance the controls reach (A4).
          await attribute(flag(target, "dynamic"), "data-tone").toBe("info");
          for (const text of ["first", "second"]) {
            await attribute(badge(target, text), "data-tone").toBe("info");
          }
        });

        await control("Flag", "on").selectOption("true");
        await control("Flag", "size").fill("3");
        await control("Badge", "tone").selectOption("warn");
        await each(async (target) => {
          for (const label of ["bare", "nested", "warned"]) {
            await attribute(flag(target, label), "data-on").toBe("yes");
            await attribute(flag(target, label), "data-size").toBe("3");
          }
          await attribute(flag(target, "warned"), "data-tone").toBe("warn");
          for (const label of ["dynamic"]) {
            await attribute(flag(target, label), "data-on").toBe("no");
            await attribute(flag(target, label), "data-size").toBe("2");
          }
          for (const text of ["first", "second"]) {
            await attribute(badge(target, text), "data-tone").toBe("warn");
          }
        });

        // Back to "(default)" one at a time, Flag's tone first: Badge's alone leaves every Flag's.
        await control("Flag", "tone").selectOption("");
        await control("Flag", "on").selectOption("");
        await control("Flag", "size").fill("");
        await each(async (target) => {
          for (const label of ["bare", "nested", "dynamic"]) {
            await attribute(flag(target, label), "data-tone").toBe("info");
            await attribute(flag(target, label), "data-on").toBe("no");
            await attribute(flag(target, label), "data-size").toBe("2");
          }
          await attribute(flag(target, "warned"), "data-tone").toBe("warn");
          await attribute(badge(target, "first"), "data-tone").toBe("warn");
        });
        await control("Badge", "tone").selectOption("");
        // Every control at "(default)": each frame shows the example as it first did.
        await each(async (target) => {
          await attribute(badge(target, "second"), "data-tone").toBe("info");
          expect(await frameRoot(page, target), target).toBe(written_.get(target));
        });

        // An instance an edit adds takes the controls of its component (A8).
        await control("Flag", "tone").selectOption("error");
        writeFileSync(example, written.replace("<Plain />", '<Plain />\n      <Flag label="d" />'));
        await each(async (target) => {
          await flag(target, "d").waitFor({ timeout: 120_000 });
          await attribute(flag(target, "d"), "data-tone").toBe("error");
          await attribute(flag(target, "warned"), "data-tone").toBe("warn");
        });
      } finally {
        writeFileSync(example, written);
        await browser.close();
        await preview.close();
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it(
    "render the example as written at their defaults, on each of eight targets",
    { timeout: 600_000 },
    async () => {
      const root = EXAMPLE_CONTROLS;
      const config = await projectConfig(root);
      const catalogue = await readCatalogue(root, config.srcDir);
      const entries = Object.fromEntries(catalogue.examples.map((each) => [each.key, each.file]));
      const transformSource = exampleTransform(root, catalogue);
      expect(transformSource).toBeDefined();
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        // One target at a time, and one server at a time: the two share the target's cache.
        for (const target of config.targets) {
          const roots: Array<string> = [];
          for (const transform of [transformSource, undefined]) {
            const server = await startTargetServer(
              targetServerOptions(root, config, target, entries, undefined, undefined, transform),
            );
            const pages = [{ target, src: `${server.origin}${FRAME_PATH}` }];
            // The page alone: this test opens no embed.
            const shell = await startShellServer(
              { shell: shellPage(shellData(catalogue, pages)), embed: "" },
              0,
            );
            try {
              await page.goto(shell.url);
              const status = page.locator(`figure[data-target="${target}"] output`);
              await expect.poll(() => status.textContent(), { timeout: 180_000 }).toBe("rendered");
              roots.push(await frameRoot(page, target));
            } finally {
              await shell.close();
              await server.close();
            }
          }
          expect(roots[0], target).toContain('data-flag="bare"');
          expect(roots[0], target).toBe(roots[1]);
        }
      } finally {
        await browser.close();
      }
    },
  );
});

describe("an embed's options in development (ADR-0116)", () => {
  it(
    "shows an example's controls on seven targets, rendering as the shell's frames, in view",
    { timeout: 600_000 },
    async () => {
      const preview = await startPreview({ root: DESIGN_SYSTEM });
      const browser = await chromium.launch();
      const host = await hostPage();
      try {
        const catalogue = await readCatalogue(
          DESIGN_SYSTEM,
          (await projectConfig(DESIGN_SYSTEM)).srcDir,
        );
        const groups = catalogue.examples.find((each) => each.id === "examples/Buttons")!.controls;

        // What the shell's frames show for each value, Astro's included: a dev server renders it.
        const shell = await browser.newPage();
        const frame = (target: string) =>
          shell.frameLocator(`figure[data-target="${target}"] iframe`);
        const status = (target: string) => shell.locator(`figure[data-target="${target}"] output`);
        const shown: Record<string, Record<string, string>> = { secondary: {}, primary: {} };
        await shell.goto(`${preview.url}#example:examples/Buttons`);
        for (const target of TARGETS) {
          await frame(target).getByRole("button", { name: "Save" }).waitFor({ timeout: 180_000 });
        }
        for (const value of ["secondary", "primary"]) {
          await shell
            .getByRole("group", { name: "Button", exact: true })
            .getByLabel("variant", { exact: true })
            .selectOption(value);
          for (const target of TARGETS) {
            await expect
              .poll(() => status(target).textContent(), { timeout: 60_000, message: target })
              .toBe("rendered");
            shown[value]![target] = await frame(target)
              .locator("[data-uf-preview-root]")
              .innerHTML();
          }
        }
        await shell.close();

        const page = await browser.newPage();
        const root = () => page.locator("[data-uf-preview-root]").innerHTML();
        const variant = () =>
          page.getByRole("region", { name: "Controls" }).getByLabel("variant", { exact: true });
        for (const target of TARGETS) {
          const embed = `${preview.url}${EMBED_FILE}?example=examples/Buttons&target=${target}`;
          await page.goto(embed);
          await page.getByRole("button", { name: "Save" }).waitFor({ timeout: 120_000 });
          const plain = await root();
          await page.goto(`${embed}&controls=true`);
          await page.getByRole("button", { name: "Save" }).waitFor({ timeout: 120_000 });
          expect(await panel(page), target).toEqual(expectedPanel(groups));
          expect(await root(), target).toBe(plain);
          for (const value of ["secondary", "primary"]) {
            await variant().selectOption(value);
            await expect
              .poll(root, { timeout: 60_000, message: `${value} on ${target}` })
              .toBe(shown[value]![target]);
          }
          await expect
            .poll(() => page.getByRole("button", { name: "Cancel" }).getAttribute("data-variant"))
            .toBe("secondary");
          await variant().selectOption("");
          await expect.poll(root, { timeout: 60_000, message: `default on ${target}` }).toBe(plain);
          expect(await page.locator("[data-uf-embed-failure]").count(), target).toBe(0);
        }

        // A fixed height, and an iframe's default of 150 px: the first field shows whole.
        for (const target of ["vue", "astro"]) {
          for (const height of [300, undefined]) {
            const src = `${preview.url}${EMBED_FILE}?example=examples/Buttons&target=${target}&controls=true`;
            host.set(framing(src, height));
            await page.goto(host.url);
            const framed = page.frameLocator("#embed");
            await framed.getByRole("button", { name: "Save" }).waitFor({ timeout: 120_000 });
            const place = await fieldPlace(framed);
            const at = `${target} at ${height ?? "default"}: ${JSON.stringify(place)}`;
            expect(place.innerHeight, at).toBe(height ?? 150);
            expectFieldInView(place, at);
            expectFilled(place, at);
          }
        }
      } finally {
        await host.close();
        await browser.close();
        await preview.close();
      }
    },
  );

  it(
    "themes the example by Styleframe's selector, keeps the panel's own styles, and resizes",
    { timeout: 300_000 },
    async () => {
      const preview = await startPreview({ root: EMBED });
      const browser = await chromium.launch();
      const host = await hostPage();
      try {
        const page = await browser.newPage();
        const embed = (example: string, target: string, query: string) =>
          `${preview.url}${EMBED_FILE}?example=examples/${example}&target=${target}${query}`;
        const panelStyle = () =>
          page.locator("uf-embed-controls").evaluate((host) =>
            ["label", "select"].map((selector) => {
              const style = getComputedStyle(host.shadowRoot!.querySelector(selector)!);
              return [style.color, style.fontFamily, style.fontSize, style.lineHeight];
            }),
          );
        for (const target of ["vue", "astro"]) {
          // The colour mode reaches the example's own styles, as Styleframe's themes select it.
          const colours: Record<string, string> = {};
          for (const theme of ["light", "dark"]) {
            await page.goto(embed("Bare", target, `&theme=${theme}`));
            await page.getByText("First line").waitFor({ timeout: 120_000 });
            colours[theme] = await page
              .locator(".note")
              .evaluate((note) => getComputedStyle(note).color);
          }
          expect(colours, target).toEqual({ light: "rgb(10, 20, 30)", dark: "rgb(230, 240, 250)" });

          // A project's global styles reach the example and stop at the panel.
          const styles: Record<string, unknown> = {};
          for (const example of ["Styled", "Bare"]) {
            await page.goto(embed(example, target, "&controls=true"));
            await page.getByText("First line").waitFor({ timeout: 120_000 });
            styles[example] = await panelStyle();
          }
          expect(
            await page.locator("body").evaluate((body) => getComputedStyle(body).fontFamily),
          ).not.toContain("Georgia");
          await page.goto(embed("Styled", target, ""));
          await page.getByText("First line").waitFor({ timeout: 120_000 });
          expect(
            await page.locator("body").evaluate((body) => getComputedStyle(body).fontFamily),
            target,
          ).toContain("Georgia");
          expect(styles.Styled, target).toEqual(styles.Bare);

          // A control that changes the example's height changes the report, which settles with
          // nothing scrolling.
          for (const query of ["&resize=true&controls=true", "&resize=true"]) {
            const at = `${target}${query}`;
            host.set(framing(embed("Bare", target, query), 1000));
            await page.goto(host.url);
            const framed = page.frameLocator("#embed");
            await framed.getByText("First line").waitFor({ timeout: 120_000 });
            const first = await settled(page, at);
            expect(first, at).toBeLessThan(1000);
            const frame = await embedFrame(page);
            let boxes = await scrolls(frame);
            expectNoScroll(boxes, `${at}: ${JSON.stringify(boxes)}`);
            if (!query.includes("controls")) {
              expect(first, at).toBeLessThanOrEqual(Math.ceil(boxes.example) + 2);
              continue;
            }
            await framed
              .getByRole("region", { name: "Controls" })
              .getByLabel("lines", { exact: true })
              .selectOption("three");
            await framed.getByText("Third line").waitFor({ timeout: 60_000 });
            const second = await settled(page, `${at}, three lines`);
            expect(second, at).toBeGreaterThan(first);
            await expect.poll(() => frame.evaluate(() => innerHeight)).toBe(second);
            boxes = await scrolls(frame);
            expectNoScroll(boxes, `${at}, three lines: ${JSON.stringify(boxes)}`);
          }
        }
      } finally {
        await host.close();
        await browser.close();
        await preview.close();
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
      const exited = new Promise<number | null>((done) => {
        child.once("exit", (code) => done(code));
      });
      try {
        await new Promise<void>((done, fail) => {
          child.stdout.on("data", (chunk) => {
            stdout += String(chunk);
            if (stdout.includes("Press Ctrl+C to stop.")) {
              done();
            }
          });
          void exited.then((code) => fail(new Error(`exited with ${code}:\n${stdout}\n${stderr}`)));
        });
        expect(stdout).toContain(`unframework preview: http://${PREVIEW_HOST}:${port}/`);
        const origins = [...stdout.matchAll(/^ {2}(\w+): (http:\/\/\S+)$/gm)];
        expect(origins.map((match) => match[1])).toEqual(TARGETS);
        const ports = [port, ...origins.map((match) => Number(new URL(match[2]!).port))];
        for (const each of ports) {
          expect(await listening(each), String(each)).toBe(true);
        }
        const page = await fetch(`http://${PREVIEW_HOST}:${port}/`);
        expect(await page.text()).toContain("<title>unframework preview</title>");

        child.kill("SIGINT");
        expect(await exited, stderr).toBe(0);
        expect(stdout).toContain("unframework preview: stopped.");
        for (const each of ports) {
          expect(await listening(each), String(each)).toBe(false);
        }
      } finally {
        if (child.exitCode === null) {
          child.kill("SIGKILL");
        }
      }
    },
  );

  it(
    "prints UF7012 to stderr for a malformed tag in an example's doc comment, and runs",
    { timeout: 120_000 },
    async () => {
      const root = fileURLToPath(new URL("fixtures/metadata", import.meta.url));
      let stdout = "";
      let stderr = "";
      const code = await preview(
        ["--target", "vue"],
        {
          cwd: root,
          stdout: (text) => void (stdout += text),
          stderr: (text) => void (stderr += text),
        },
        Promise.resolve(),
      );
      expect(code).toBe(0);
      expect(stderr).toMatch(
        /^examples\/Badge\.example\.uf\.tsx:5:4 warning UF7012: The example Badge's @order "two" is not a number/,
      );
      expect(stderr.trimEnd().split("\n")).toHaveLength(1);
      expect(stdout).toContain("unframework preview: stopped.");
    },
  );
});
