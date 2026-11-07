import type { Plugin } from "vite";

import { unframeworkUnplugin } from "./plugin.ts";
import type { UnframeworkOptions } from "./plugin.ts";

/**
 * The unframework Vite plugin: imports of `.uf.tsx` files load as the target's source, under ids
 * that the framework's own plugin claims. Returns `[pre, post]`: `pre` resolves and compiles;
 * `post` turns a module that `onCompile` failed into `throw new Error(message)`. Place it before
 * the framework's plugins. With no `target`, the framework's plugin decides it (ADR-0075).
 */
export default function unframework(options?: UnframeworkOptions): Plugin[] {
  return unframeworkUnplugin.vite(options);
}

export type { CompileEvent, UnframeworkApi, UnframeworkOptions } from "./plugin.ts";
