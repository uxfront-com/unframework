// The Storybook configuration every target's `.storybook/main.ts` shares, on `@storybook/html-vite`
// with no addons: the components compile through the unplugin (ADR-0021), the build is a development
// build as a Vitest browser project's is, and it leaves a manifest of what it compiled and failed.
import { fileURLToPath } from "node:url";

import { eventsOfModule, writeBuildManifest } from "@unframework/testing/node";
import type { BuildFailure, BuildManifest, BuildManifestModule } from "@unframework/testing/node";
import unframework from "@unframework/unplugin/vite";
import type { CompileEvent, UnframeworkOptions } from "@unframework/unplugin/vite";
import { mergeConfig } from "vite";
import type { InlineConfig, Plugin, UserConfig } from "vite";

import { isolateFailures } from "./isolate.ts";

export { buildIsolated } from "./isolate.ts";

/** What a target's Storybook is made of. */
export interface StorybookOptions {
  /** The target's name, for the manifest. */
  target: string;
  /** The Vite root, which every compile's file name is relative to. */
  root: string;
  /** Where the stories files live: Storybook reads them from here. */
  stories: readonly string[];
  /** The unplugin's options. Its `onCompile` runs after the manifest has recorded the compile. */
  unplugin: UnframeworkOptions;
  /** The main source of each case, by absolute path: the modules a spec mounts. */
  mainModules: ReadonlySet<string>;
  /** What runs before the unplugin, such as the styling engines' plugins. */
  plugins(): Promise<Plugin[]>;
  /** The target toolchain's Vite configuration: its framework plugin. */
  vite(): Promise<UserConfig> | UserConfig;
}

/** The part of Storybook's main configuration this sets. */
export interface StorybookConfig {
  framework: "@storybook/html-vite";
  stories: string[];
  addons: string[];
  core: { disableTelemetry: boolean; disableWhatsNewNotifications: boolean };
  features: Record<string, boolean>;
  viteFinal(config: InlineConfig): Promise<InlineConfig>;
}

/** Records each main module's events, and writes the manifest when the build has finished. */
function manifestPlugin(
  options: StorybookOptions,
  failures: () => BuildFailure[],
): {
  plugin: Plugin;
  record(event: CompileEvent): void;
} {
  const modules = new Map<string, BuildManifestModule>();
  let outDir: string;
  return {
    record(event) {
      if (!options.mainModules.has(event.file) || !event.ir) return;
      let entry: BuildManifestModule;
      try {
        entry = { events: eventsOfModule(event.ir, event.file) };
      } catch (error) {
        // A mount of it fails with this, as `compiledEvents` does; the compile itself is fine.
        entry = { error: (error as Error).message };
      }
      modules.set(event.file, entry);
    },
    plugin: {
      name: "uf-visual:build-manifest",
      apply: "build",
      configResolved(config) {
        outDir = config.build.outDir;
      },
      closeBundle() {
        const manifest: BuildManifest = {
          target: options.target,
          root: options.root,
          modules: Object.fromEntries(modules),
          failures: failures(),
        };
        writeBuildManifest(outDir, manifest);
        // A build with failures still exits 0, so it says what it failed.
        for (const { module, cause } of manifest.failures) {
          console.error(`[uf] ${module}: ${cause.split("\n")[0]}`);
        }
      },
    },
  };
}

/**
 * Every Storybook feature that would add a decorator or a global to the preview is off: a story's
 * document holds the component and Storybook's own hidden blocks, and nothing else.
 */
const FEATURES: Record<string, boolean> = {
  actions: false,
  backgrounds: false,
  controls: false,
  highlight: false,
  interactions: false,
  measure: false,
  outline: false,
  viewport: false,
  developmentModeForBuild: true,
};

/** A target's main configuration. */
export function createStorybookConfig(options: StorybookOptions): StorybookConfig {
  return {
    framework: "@storybook/html-vite",
    stories: [...options.stories],
    addons: [],
    core: { disableTelemetry: true, disableWhatsNewNotifications: true },
    features: FEATURES,
    async viteFinal(config) {
      const isolation = isolateFailures(options.root);
      const manifest = manifestPlugin(options, isolation.failures);
      const toolchain = await options.vite();
      const framework = { ...toolchain, plugins: await isolation.wrap(toolchain.plugins) };
      const merged = mergeConfig(mergeConfig(config, framework), {
        root: options.root,
        mode: "development",
        plugins: [
          ...(await isolation.wrap([
            ...(await options.plugins()),
            ...unframework({
              ...options.unplugin,
              onCompile: isolation.guarded((event) => {
                manifest.record(event);
                return options.unplugin.onCompile?.(event);
              }),
            }),
          ])),
          isolation.plugin,
          manifest.plugin,
        ],
        resolve: { alias: hostAliases() },
        build: { minify: false, cssMinify: false, target: "esnext" },
      } satisfies InlineConfig) as InlineConfig;
      return merged;
    },
  };
}

/**
 * The page host in Vitest's place, in this build alone, so one spec text serves both runners until
 * the cutover. `@unframework/testing` needs none: it reaches its runner through the host port, and
 * the runner story's boot installs the page host there.
 */
function hostAliases(): { find: RegExp; replacement: string }[] {
  const replacement = fileURLToPath(import.meta.resolve("@unframework/testing/hosts/page/vitest"));
  return [
    { find: /^vitest$/, replacement },
    { find: /^vitest\/browser$/, replacement },
  ];
}
