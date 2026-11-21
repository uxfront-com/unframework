// When the render server starts (UXF-916): a Vitest browser project starts it when Vitest
// configures the project, so no test's render waits for the start in the render queue.
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import type { Plugin } from "vite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { astroBrowserRef } from "../src/toolchain/browser.ts";
import { closeAstroRenderServers, renderAstroComponent } from "../src/toolchain/render.ts";

const base = join(import.meta.dirname, "..", ".uf-tmp", `render-boot-${process.pid}`);

/** A browser project's plugin, as Vitest configures it: only `vitest.onClose` is read. */
function configure(plugin: Plugin): ReturnType<typeof vi.fn> {
  const onClose = vi.fn();
  const hook = plugin.configureVitest as unknown as (context: {
    vitest: { onClose: (close: () => unknown) => void };
  }) => void;
  hook({ vitest: { onClose } });
  return onClose;
}

/** What a browser project does when it imports a component: the ref plugin's transform. */
function compile(plugin: Plugin, id: string, source: string): void {
  const transform = plugin.transform as { handler(code: string, id: string): unknown };
  transform.handler.call(undefined, source, id);
}

/**
 * The project's plugins, as `ToolchainContext.plugins`: the render server asks for them once,
 * as it starts, so each call is one server start.
 */
function projectPlugins(start?: () => void) {
  return vi.fn(async (): Promise<Plugin[]> => {
    start?.();
    return [];
  });
}

describe("the render server's start", { timeout: 60_000 }, () => {
  beforeAll(() => mkdirSync(base, { recursive: true }));
  afterAll(async () => {
    await closeAstroRenderServers();
    rmSync(base, { recursive: true, force: true });
  });

  it("starts when Vitest configures the browser project, before any render asks for it", async () => {
    const root = join(base, "eager");
    mkdirSync(root, { recursive: true });
    const plugins = projectPlugins();
    const plugin = astroBrowserRef({ root, plugins });
    const onClose = configure(plugin);
    expect(onClose).toHaveBeenCalledWith(closeAstroRenderServers);
    // No render was asked for: only the configure hook can have started the server.
    await vi.waitFor(() => expect(plugins).toHaveBeenCalledTimes(1), { timeout: 30_000 });

    const id = join(root, "Hello.uf.tsx.astro");
    compile(plugin, id, "<p>hello</p>\n");
    const result = await renderAstroComponent(root, { id, props: {} }, undefined, plugins);
    expect(result).toEqual({ html: "<p>hello</p>", console: [] });
    // The render used the server the configure hook started, and started no second one.
    expect(plugins).toHaveBeenCalledTimes(1);
  });

  it("starts one server for two projects on one root, as browser:astro and hydrate:astro are", async () => {
    const root = join(base, "shared");
    mkdirSync(root, { recursive: true });
    const browser = projectPlugins();
    const hydrate = projectPlugins();
    configure(astroBrowserRef({ root, plugins: browser }));
    configure(astroBrowserRef({ root, plugins: hydrate }));
    await vi.waitFor(() => expect(browser).toHaveBeenCalledTimes(1), { timeout: 30_000 });
    expect(hydrate).not.toHaveBeenCalled();
  });

  it("fails the first render with the error of a start that failed, and raises nothing before", async () => {
    const root = join(base, "broken");
    mkdirSync(root, { recursive: true });
    const plugins = projectPlugins(() => {
      throw new Error("the styling engine's plugin cannot load");
    });
    const plugin = astroBrowserRef({ root, plugins });
    configure(plugin);
    await vi.waitFor(() => expect(plugins).toHaveBeenCalledTimes(1), { timeout: 30_000 });
    // A rejection nobody handled yet would fail this file as an unhandled error here.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const id = join(root, "Hello.uf.tsx.astro");
    compile(plugin, id, "<p>hello</p>\n");
    await expect(renderAstroComponent(root, { id, props: {} }, undefined, plugins)).rejects.toThrow(
      "the styling engine's plugin cannot load",
    );
  });

  it("starts nothing for a plugin made without a context, until the first render", async () => {
    const root = join(base, "lazy");
    mkdirSync(root, { recursive: true });
    const plugins = projectPlugins();
    const plugin = astroBrowserRef();
    configure(plugin);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(plugins).not.toHaveBeenCalled();

    const id = join(root, "Hello.uf.tsx.astro");
    compile(plugin, id, "<p>lazy</p>\n");
    const result = await renderAstroComponent(root, { id, props: {} }, undefined, plugins);
    expect(result.html).toBe("<p>lazy</p>");
    expect(plugins).toHaveBeenCalledTimes(1);
  });
});
