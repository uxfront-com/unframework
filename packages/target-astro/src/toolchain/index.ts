// The Astro toolchain (plan §5.7): how tests and tooling build, check and run Astro output.
// Heavy tools (Astro, its compiler, Vite, the TypeScript 6 checker) load on first use, so a
// config that imports every target's toolchain pays only for the projects it runs.
import type { Toolchain } from "@unframework/codegen";
import {
  lintWithEslint,
  lintWithOxlint,
  mergeLintResults,
} from "@unframework/codegen/toolchain-node";

import { astroBrowserRef } from "./browser.ts";
import { astroTypecheck } from "./check.ts";
import { astroFrameworkCompile } from "./compile.ts";
import { astroViteConfig } from "./config.ts";
import { createAstroRenderCommand } from "./render.ts";

/**
 * Astro is static: there is no client runtime and nothing to hydrate (interactivity is
 * unsupported, UF4001). `ssr` projects compile and render through Astro's own pipeline;
 * `browser` projects mount the server HTML that the `ufAstroRender` command returns.
 */
export const toolchain: Toolchain = {
  name: "astro",
  vite(mode, context) {
    if (mode === "ssr") return astroViteConfig(context.root);
    // Nothing to pre-bundle: in the browser a compiled component is a plain reference that
    // imports nothing, and the unframework plugin keeps virtual ids out of the dep scan.
    return { plugins: [astroBrowserRef()] };
  },
  browserCommands: (context) => ({ ufAstroRender: createAstroRenderCommand(context) }),
  client: "@unframework/target-astro/toolchain/client",
  server: "@unframework/target-astro/toolchain/server",
  frameworkCompile: astroFrameworkCompile,
  typecheck: astroTypecheck,
  // L5 (ADR-0042): oxlint's shared baseline over the frontmatter, ESLint over the whole file.
  lint: async (files, context) =>
    mergeLintResults(
      await Promise.all([lintWithOxlint(files, context), lintWithEslint(files, context)]),
    ),
};

export default toolchain;
