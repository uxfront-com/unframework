// Styleframe in the harness (plan §4.4, ADR-0064): every output keeps a component's Styleframe
// imports as written, so the ssr and browser projects load Styleframe's own Vite plugin beside
// the unplugin, with the corpus's one configuration. It is Community only: building it needs no
// licence key, and CI sets none.
import { join } from "node:path";

import type { Plugin } from "vite";

import { ROOT } from "./paths.ts";

/** The corpus's Styleframe configuration: its tokens, utilities, recipes and themes. */
export const STYLEFRAME_CONFIG: string = join(ROOT, "styleframe.config.ts");

/**
 * The declarations of Styleframe's virtual modules for the corpus's configuration, which the
 * checkers read beside the sources and the outputs (`check-types`, L4): written by
 * {@link styleframeDeclarations}, and compared with it by `styleframe.unit.test.ts`.
 */
export const STYLEFRAME_DECLARATIONS: string = join(ROOT, "styleframe.d.ts");

/**
 * The utility classes a `.uf.tsx` source writes in a `class`, for Styleframe's scanner, whose JSX
 * extractor reads only `className`: `_padding:lg`, `_border-radius:[4px]`.
 */
export function sourceUtilities(content: string, file: string): string[] {
  if (!file.endsWith(".uf.tsx")) return [];
  return [...content.matchAll(/\bclass="([^"]*)"/g)].flatMap(([, value]) =>
    value!.split(/\s+/).filter((name) => name.startsWith("_")),
  );
}

/**
 * Styleframe's Vite plugin for the ssr and browser projects, with the corpus's configuration
 * unless another is given. It resolves `virtual:styleframe`
 * and `virtual:styleframe.css`, which the unplugin leaves alone, so the order of the two plugins
 * does not matter; it is listed first, as Styleframe's installation guide does. Its scanner reads
 * the corpus's sources for utility classes, and it neither minifies class names nor writes
 * declarations into the working directory (`styleframe.d.ts` holds them).
 */
export async function styleframePlugin(config: string = STYLEFRAME_CONFIG): Promise<Plugin[]> {
  const { default: styleframe } = await import("styleframe/plugin/vite");
  return [
    styleframe({
      entry: config,
      silent: true,
      minify: false,
      dts: { enabled: false },
      // No `*.styleframe.ts` extends the configuration: only the root is searched.
      include: [join(ROOT, "*.styleframe.ts")],
      scanner: { content: [join(ROOT, "cases/**/*.uf.tsx")], extractors: [sourceUtilities] },
    }),
  ].flat();
}

/**
 * The declarations of Styleframe's virtual modules for a configuration: those Styleframe's
 * transpiler writes for a consumer (`shims.d.ts`), without the `styleframe()` export, which only
 * a `*.styleframe.ts` file reads and which would make every checker resolve `@styleframe/core`.
 */
export async function styleframeDeclarations(config: string = STYLEFRAME_CONFIG): Promise<string> {
  const [{ loadModule }, { transpile }] = await Promise.all([
    import("styleframe/loader"),
    import("styleframe/transpiler"),
  ]);
  const { instance } = await loadModule(config);
  const { files } = await transpile(instance, { type: "dts" });
  const shims = files.find((file) => file.name === "shims.d.ts");
  if (!shims) throw new Error("Styleframe's transpiler wrote no shims.d.ts.");
  return shims.content
    .replace(/^\s*import type \{ Styleframe \} from "@styleframe\/core";\n\n?/m, "")
    .replace(/^\s*export function styleframe\(\): Styleframe;\n\n?/m, "");
}
