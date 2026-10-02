import type { UserConfig } from "vite";

/**
 * The Vite configuration of Astro's own pipeline (`getViteConfig` from `astro/config`), so a
 * `.uf.tsx.astro` virtual id compiles exactly as an `.astro` file does in an Astro project.
 * The SSR test project and the browser render server are both built from it.
 *
 * - `configFile: false`: a stray `astro.config.*` in the root never changes the pipeline.
 * - The dev toolbar is off: in `serve` it annotates every element with
 *   `data-astro-source-file` and `data-astro-source-loc`.
 * - `logLevel: "warn"`: Astro's warnings stay visible; its info chatter does not.
 *
 * Astro is imported on first use, so loading the toolchain stays cheap for other projects.
 */
export async function astroViteConfig(
  root: string,
  overrides: UserConfig = {},
): Promise<UserConfig> {
  const { getViteConfig } = await import("astro/config");
  const configure = getViteConfig(overrides, {
    root,
    configFile: false,
    logLevel: "warn",
    devToolbar: { enabled: false },
  });
  return configure({ command: "serve", mode: "test" });
}
