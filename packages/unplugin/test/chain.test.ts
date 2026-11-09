import type { Plugin } from "vite";
// The map steps the framework plugins leave undone (ADR-0074).
import { describe, expect, it, vi } from "vitest";

import { chainQwikSegments, chainSvelteOnce } from "../src/chain.ts";

/** Calls a hook as Vite would, with a context holding only what the steps read. */
function call(plugin: Plugin, hook: "transform" | "load", context: object, ...args: unknown[]) {
  const declared = plugin[hook] as unknown;
  const handler = (
    typeof declared === "function" ? declared : (declared as { handler: unknown }).handler
  ) as (this: object, ...rest: unknown[]) => unknown;
  return handler.apply(context, args);
}

describe("chainSvelteOnce", () => {
  function compile() {
    const seen: unknown[] = [];
    const plugin: Plugin = {
      name: "vite-plugin-svelte:compile",
      transform: {
        handler() {
          seen.push(this.getCombinedSourcemap());
        },
      },
    };
    return { plugin, seen };
  }
  const context = { getCombinedSourcemap: () => "combined" };

  it("hides the load map from the compile of a module of ours", () => {
    const { plugin, seen } = compile();
    chainSvelteOnce([plugin], (id) => id === "own");
    call(plugin, "transform", context, "code", "own");
    expect(seen).toEqual([undefined]);
  });

  it("leaves every other module to Svelte's own merge", () => {
    const { plugin, seen } = compile();
    chainSvelteOnce([plugin], (id) => id === "own");
    call(plugin, "transform", context, "code", "other.svelte");
    expect(seen).toEqual(["combined"]);
  });

  it("does nothing without the Svelte plugin", () => {
    expect(() => chainSvelteOnce([{ name: "other" }], () => true)).not.toThrow();
  });
});

describe("chainQwikSegments", () => {
  const parent = {
    version: 3 as const,
    file: "m.tsx",
    sources: ["m.uf.tsx"],
    sourcesContent: [""],
    names: [],
    mappings: "AAAA",
  };
  const segment = { version: 3, sources: ["m.tsx"], names: [], mappings: "AAAA" };

  it("chains a segment's map on through its module's load map", async () => {
    const plugin: Plugin = {
      name: "vite-plugin-qwik",
      load: async () => ({ code: "x", map: segment }),
    };
    chainQwikSegments([plugin], () => parent);
    const result = (await call(plugin, "load", {}, "m.uf.tsx_a.js")) as {
      map: { sources: string[] };
    };
    expect(result.map.sources).toEqual(["m.uf.tsx"]);
  });

  it("leaves a module with no load map to the optimizer", async () => {
    const loaded = { code: "x", map: segment };
    const plugin: Plugin = { name: "vite-plugin-qwik", load: { handler: async () => loaded } };
    chainQwikSegments([plugin], () => undefined);
    await expect(call(plugin, "load", {}, "other.js")).resolves.toBe(loaded);
  });

  it("leaves a load with no result alone", async () => {
    const load = vi.fn(async () => null);
    const plugin: Plugin = { name: "vite-plugin-qwik", load };
    chainQwikSegments([plugin], () => parent);
    await expect(call(plugin, "load", {}, "m.uf.tsx_a.js")).resolves.toBeNull();
    expect(load).toHaveBeenCalledOnce();
  });
});
