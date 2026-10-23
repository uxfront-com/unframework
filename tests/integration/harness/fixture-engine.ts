// A styling engine of a few lines, with no dependency (ADR-0064): its Vite plugin registers
// `virtual:fixture-engine`, whose one function returns class names, and
// `virtual:fixture-engine.css`, its stylesheet. Nobody wrote the compiler for it, so the
// `engines/fixture-engine` case proves that any engine's virtual modules pass through as
// Styleframe's do.
import { join } from "node:path";

import type { Plugin } from "vite";

import { ROOT } from "./paths.ts";

/** The declarations of the engine's virtual modules, which the checkers read (`check-types`, L4). */
export const FIXTURE_ENGINE_DECLARATIONS: string = join(ROOT, "fixture-engine.d.ts");

const MODULE = "virtual:fixture-engine";
const STYLESHEET = "virtual:fixture-engine.css";

/** The engine's one function: the class names of a chip in a tone. */
const CODE = `export function chip(tone) {
  return tone === "accent" ? "fe-chip fe-chip--accent" : "fe-chip";
}
`;

const CSS = `.fe-chip {
  display: inline-block;
  padding: 4px 8px;
  border: 2px solid rgb(17, 24, 39);
  border-radius: 4px;
}

.fe-chip--accent {
  background-color: rgb(190, 24, 93);
  color: rgb(255, 255, 255);
}
`;

/**
 * The engine's Vite plugin. The module's id takes Rollup's `\0` prefix, which no other plugin
 * reads; the stylesheet keeps its own id, which ends in `.css`, so Vite's CSS pipeline handles it.
 */
export function fixtureEnginePlugin(): Plugin {
  return {
    name: "fixture-engine",
    enforce: "pre",
    resolveId: (id) => (id === MODULE ? `\0${MODULE}` : id === STYLESHEET ? STYLESHEET : null),
    load: (id) => (id === `\0${MODULE}` ? CODE : id === STYLESHEET ? CSS : null),
  };
}
