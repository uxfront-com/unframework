// Vitest's `Plugin` is Vite's, with the `configureVitest` hook declared.
import type { Plugin } from "vitest/config";

import { ASTRO_VIRTUAL_ID, astroComponentRef } from "./protocol.ts";
import { closeAstroRenderServers } from "./render.ts";
import { recordAstroSource } from "./sources.ts";

/**
 * The browser project's stand-in for Astro's plugins, which must not run there: in the client
 * environment they replace every `.astro` module with a stub that throws, and in `serve` they
 * install a catch-all middleware next to Vitest's own.
 *
 * It records the Astro source the unframework plugin loaded for each virtual id, then replaces
 * the module with a serialisable reference (`AstroComponentRef`) that the mount adapter sends to
 * `ufAstroRender`. When Vitest closes, it closes the render servers.
 */
export function astroBrowserRef(): Plugin {
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
    },
  };
}
