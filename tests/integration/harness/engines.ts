// The styling engines the corpus runs with (ADR-0064): Styleframe, the engine the `styleframe/`
// and `theming/` cases test, and a fixture engine with no dependency (`engines/fixture-engine`).
// Every output keeps their `virtual:` imports as written, and their own Vite plugins resolve
// them, in every ssr and browser project and in Astro's render server.
import type { ToolchainContext } from "@unframework/codegen";
import type { Plugin } from "vite";

import { FIXTURE_ENGINE_DECLARATIONS, fixtureEnginePlugin } from "./fixture-engine.ts";
import { ROOT, toolchainDir } from "./paths.ts";
import { STYLEFRAME_DECLARATIONS, styleframePlugin } from "./styleframe.ts";

/** The declarations of every engine's virtual modules, which the checkers read beside the outputs. */
export const ENGINE_DECLARATIONS: readonly string[] = [
  STYLEFRAME_DECLARATIONS,
  FIXTURE_ENGINE_DECLARATIONS,
];

/** A fresh set of every engine's Vite plugins, listed before the unplugin's. */
export async function enginePlugins(): Promise<Plugin[]> {
  return [...(await styleframePlugin()), fixtureEnginePlugin()];
}

/**
 * Where a target's toolchain runs a project or a Storybook: its checkers read the styling engines'
 * virtual modules beside the outputs (ADR-0064), Angular's ngtsc compiles with them, and a server
 * of the toolchain's own (Astro's render server) loads the engines' plugins too.
 */
export function toolchainContext(target: string): ToolchainContext {
  return {
    toolchainDir: toolchainDir(target),
    root: ROOT,
    declarations: ENGINE_DECLARATIONS,
    plugins: enginePlugins,
  };
}
