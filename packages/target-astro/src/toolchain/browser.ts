import type { ToolchainContext } from "@unframework.dev/codegen";
// Vitest's `Plugin` is Vite's, with the `configureVitest` hook declared.
import type { Plugin } from "vitest/config";

import { ASTRO_VIRTUAL_ID, astroComponentRef } from "./protocol.ts";
import { closeAstroRenderServers, startAstroRenderServer } from "./render.ts";
import { recordAstroSource } from "./sources.ts";

/**
 * The browser project's stand-in for Astro's plugins, which must not run there: in the client
 * environment they replace every `.astro` module with a stub that throws, and in `serve` they
 * install a catch-all middleware next to Vitest's own.
 *
 * It records the Astro source the unframework plugin loaded for each virtual id, then replaces
 * the module with a serialisable reference (`AstroComponentRef`) that the mount adapter sends to
 * `ufAstroRender`. When Vitest configures the project, it starts the render server for the
 * context's root, with the context's plugins, so no test waits for the start (UXF-916); without
 * a context, the first render starts it. When Vitest closes, it closes the render servers.
 * Outside Vitest, as in the preview (ADR-0088), the hook never runs, and nothing starts early.
 */
export function astroBrowserRef(context?: Pick<ToolchainContext, "root" | "plugins">): Plugin {
  return {
    name: "unframework:astro-browser-ref",
    enforce: "pre",
    transform: {
      filter: { id: ASTRO_VIRTUAL_ID },
      handler(source, id) {
        const ref = astroComponentRef(id);
        recordAstroSource(ref.id, source);
        return { code: `export default ${JSON.stringify(ref)};\n`, map: null, moduleType: "js" };
      },
    },
    configureVitest({ vitest }) {
      vitest.onClose(closeAstroRenderServers);
      if (context) startAstroRenderServer(context.root, context.plugins);
    },
  };
}
