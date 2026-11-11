import { createDiagnostic, formatDiagnostic } from "@unframework.dev/diagnostics";
import type { AstroIntegration } from "astro";

import type { UnframeworkOptions } from "./plugin.ts";
import unframeworkVite from "./vite.ts";

/** Options of the Astro integration: the plugin's, without the target, which it sets to Astro. */
export type UnframeworkAstroOptions = Omit<UnframeworkOptions, "target">;

/**
 * The unframework Astro integration: adds the Vite plugin with the Astro target, so an import of a
 * `.uf.tsx` file loads as an `.astro` component, which Astro's own plugin compiles.
 */
export default function unframework(options: UnframeworkAstroOptions = {}): AstroIntegration {
  return {
    name: "unframework",
    hooks: {
      "astro:config:setup": ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [unframeworkVite({ target: "astro", ...options })],
            // Astro's scan entries match every `.tsx` under `src`, and the scan would read a
            // `.uf.tsx` file as plain JSX. Without React's JSX runtime installed, it would fail
            // with an error, and Vite would lose the dependencies it would have found,
            // pre-bundling those only as requests reach them.
            optimizeDeps: { entries: ["!**/*.uf.tsx"] },
          },
        });
      },
      // Done rather than setup: a later integration may still set the option there. The printer's
      // layout assumes `"jsx"`, and no file can pin it (ADR-0026).
      "astro:config:done": ({ config, logger }) => {
        if (config.compressHTML === "jsx") return;
        const diagnostic = createDiagnostic("UF7010", {
          file: "astro.config",
          // A configuration has no source span to point at: the message names the option.
          span: { start: 0, end: 0 },
          message: `Astro's compressHTML is ${String(config.compressHTML)}, and outputs assume "jsx", so a component can render different whitespace from the other targets.`,
          help: 'Remove the option, or set it to "jsx".',
        });
        logger.warn(formatDiagnostic(diagnostic, undefined));
      },
    },
  };
}
