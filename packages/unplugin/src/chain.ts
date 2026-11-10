// What a module's map needs from the framework plugins after `load` (ADR-0074): each plugin in
// the chain adds its own step once.
import { chainMap } from "@unframework/codegen";
import type { SourceMapV3 } from "@unframework/codegen";
import type { Plugin } from "vite";

/** Vite's name for the Svelte plugin's compile step. */
const SVELTE_COMPILE = "vite-plugin-svelte:compile";

/**
 * Keeps Svelte's compile from merging a module's load map itself. It passes
 * `getCombinedSourcemap()` to the compiler, whose result already reaches the `.uf.tsx`, and Vite
 * then chains that map through the load map a second time, so most positions trace to nothing.
 * Without the merge, the compile's map stops at the `.svelte` text and Vite's own chain goes on.
 * `isOwn` limits this to the modules this plugin loaded. A later release of the Svelte plugin
 * that renames the step leaves the double chain, which L14's stack checks then fail on.
 */
export function chainSvelteOnce(plugins: readonly Plugin[], isOwn: (id: string) => boolean): void {
  const compile = plugins.find((plugin) => plugin.name === SVELTE_COMPILE);
  const hook = compile?.transform;
  if (!hook || typeof hook === "function") return;
  const handler = hook.handler;
  hook.handler = function (code, id, options) {
    if (!isOwn(id)) return handler.call(this, code, id, options);
    const context = Object.create(this, { getCombinedSourcemap: { value: () => undefined } });
    return handler.call(context, code, id, options);
  };
}

/** Vite's name for Qwik's plugin, whose `load` serves the optimizer's segments. */
const QWIK_PLUGIN = "vite-plugin-qwik";

/**
 * Chains a Qwik segment's map on through its module's load map. The optimizer splits a module
 * into segments that Vite loads as modules of their own, so Vite never chains the module's load
 * map onto them, and a segment's map stops at the Qwik output. `mapOf` gives the load map of the
 * segment's module, by the segment's id.
 */
export function chainQwikSegments(
  plugins: readonly Plugin[],
  mapOf: (id: string) => SourceMapV3 | undefined,
): void {
  const qwik = plugins.find((plugin) => plugin.name === QWIK_PLUGIN);
  const hook = qwik?.load;
  if (!qwik || !hook) return;
  const handler = typeof hook === "function" ? hook : hook.handler;
  const load: typeof handler = async function (id, options) {
    const result = await handler.call(this, id, options);
    const parent = mapOf(id);
    if (!parent || typeof result !== "object" || result === null) return result;
    if (!result.map) return result;
    return { ...result, map: chainMap(result.map, parent) };
  };
  if (typeof hook === "function") qwik.load = load;
  else hook.handler = load;
}
