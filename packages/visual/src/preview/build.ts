// `buildPreview` (ADR-0111): the preview as a static site, for any static host. Each target's
// frame is built with Vite's `build` on its dev server's configuration, into `<out>/<target>/`,
// and the shell is written as `<out>/index.html`, framing each by a relative URL, so the site
// serves at any path with no server. A target with no client runtime (Astro) is rendered at build
// time with each entry's initial props, and its frame reads those renders.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import type { ResolvedConfig, TargetName } from "@unframework.dev/compiler";
import { loadToolchain } from "@unframework.dev/testing/config";

import { VisualUsageError } from "../run.ts";
import { readCatalogue } from "./catalogue.ts";
import type { PreviewCatalogue } from "./catalogue.ts";
import type { PropControl } from "./controls.ts";
import { previewTargets, projectConfig, targetServerOptions } from "./index.ts";
import type { PreviewOptions } from "./index.ts";
import { STATIC_FRAME_FILE, STATIC_RENDERS_DIR } from "./protocol.ts";
import type { StaticRender } from "./protocol.ts";
import { buildTarget, renderTargetEntries } from "./servers.ts";
import type { StaticRenders } from "./servers.ts";
import { shellData, shellPage } from "./shell.ts";

/** Where a static preview goes, relative to the root: a dot directory, which discovery skips. */
export const DEFAULT_PREVIEW_OUT = ".unframework/preview";

/** The file that marks a directory a static preview wrote, which a later build may empty. */
export const PREVIEW_MARKER = ".unframework-preview";

/** The options of {@link buildPreview}. */
export interface BuildPreviewOptions {
  /** The project's root, where `unframework.config.ts` lies. */
  root: string;
  /** The targets to build: every one of the project's by default, in the project's order. */
  targets?: readonly TargetName[];
  /** The site's directory, relative to the root: {@link DEFAULT_PREVIEW_OUT} by default. */
  out?: string;
  /** Where a target's compiler stack resolves from, as {@link PreviewOptions.toolchainDirs}. */
  toolchainDirs?: PreviewOptions["toolchainDirs"];
}

/** A static preview, written. */
export interface BuiltPreview {
  /** The site's directory (absolute), whose `index.html` is the shell. */
  out: string;
  /** The targets built, in the order the shell shows them. */
  targets: TargetName[];
}

/**
 * Writes the static preview of a project into its `out` directory, emptied first, and resolves
 * once every target is built and every render server closed. Throws a {@link VisualUsageError} on
 * an `out` that holds the root or is not empty and no earlier build wrote, a target the project
 * lacks, or a project with nothing to show, and an error on a configuration, a toolchain or a
 * build that fails.
 */
export async function buildPreview(options: BuildPreviewOptions): Promise<BuiltPreview> {
  const root = realpathSync(options.root);
  const out = resolve(root, options.out ?? DEFAULT_PREVIEW_OUT);
  checkPreviewOut(root, out);
  const config = await projectConfig(root);
  const targets = previewTargets(config.targets, options.targets);
  const catalogue = await readCatalogue(root, config.srcDir);
  const entries = Object.fromEntries(
    [...catalogue.examples, ...catalogue.components].map((entry) => [entry.key, entry.file]),
  );
  if (!Object.keys(entries).length) {
    throw new VisualUsageError(
      `Nothing to preview under ${root}: add an example (*.example.uf.tsx) or a component under ${config.srcDir}.`,
    );
  }

  // Emptied once the configuration loaded: a build that cannot start keeps the last site.
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, PREVIEW_MARKER), "");
  // Vite builds for production unless `NODE_ENV` says otherwise, and sets it when unset; the
  // frames are development builds, as the dev servers serve them (`buildTarget`).
  const nodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    await buildTargets(root, out, config, targets, catalogue, entries, options.toolchainDirs);
  } finally {
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
  }
  const frames = targets.map((target) => ({ target, src: `./${target}/${STATIC_FRAME_FILE}` }));
  writeFileSync(join(out, "index.html"), shellPage(shellData(catalogue, frames)));
  return { out, targets };
}

/** Builds each target's frame into `<out>/<target>/`, one after another. */
async function buildTargets(
  root: string,
  out: string,
  config: ResolvedConfig,
  targets: readonly TargetName[],
  catalogue: PreviewCatalogue,
  entries: Readonly<Record<string, string>>,
  toolchainDirs: PreviewOptions["toolchainDirs"],
): Promise<void> {
  const props = initialProps(catalogue);
  for (const target of targets) {
    const server = targetServerOptions(root, config, target, entries, toolchainDirs);
    const dir = join(out, target);
    if ((await loadToolchain(target)).renderCommandName === undefined) {
      await buildTarget(server, dir);
      continue;
    }
    // A target with no client runtime: rendered now, since the site has no server to render it.
    const rendered = await renderTargetEntries(server, props);
    const renders: Record<string, StaticRenders[string]> = {};
    const files: [string, StaticRender][] = [];
    for (const [index, [entry, { component, ...result }]] of Object.entries(rendered).entries()) {
      const file = `${STATIC_RENDERS_DIR}/${index}.json`;
      renders[entry] = { component, file };
      files.push([file, { props: props[entry] ?? {}, ...result }]);
    }
    await buildTarget(server, dir, renders);
    mkdirSync(join(dir, STATIC_RENDERS_DIR), { recursive: true });
    for (const [file, render] of files) writeFileSync(join(dir, file), JSON.stringify(render));
  }
}

/**
 * Refuses an `out` the build must not empty: the root or a directory above it, or one that is
 * not empty and that no earlier build wrote, as `unframework visual` refuses its run directory.
 */
export function checkPreviewOut(root: string, out: string): void {
  if (contains(out, root)) {
    throw new VisualUsageError(
      `--out ${out} holds the project: the build empties its directory, so name one of its own, such as ${DEFAULT_PREVIEW_OUT}.`,
    );
  }
  if (!existsSync(out)) return;
  if (!statSync(out).isDirectory()) {
    throw new VisualUsageError(
      `--out ${out} is a file: name a directory, such as ${DEFAULT_PREVIEW_OUT}.`,
    );
  }
  const entries = readdirSync(out);
  if (entries.length && !entries.includes(PREVIEW_MARKER)) {
    throw new VisualUsageError(
      `--out ${out} is not empty and no earlier build wrote it: the build empties its directory, so name a new one.`,
    );
  }
}

/** Whether `path` is `directory` or lies inside it. */
function contains(directory: string, path: string): boolean {
  const rel = relative(directory, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * The props the shell first sends each entry: none for an example, and for a component each
 * required prop at its control's initial value, since an optional one starts unset (`controls.ts`).
 */
export function initialProps(catalogue: PreviewCatalogue): Record<string, Record<string, unknown>> {
  const props: Record<string, Record<string, unknown>> = {};
  for (const example of catalogue.examples) props[example.key] = {};
  for (const component of catalogue.components) {
    props[component.key] = Object.fromEntries(
      component.controls
        .filter((control: PropControl) => !control.optional)
        .map((control) => [control.name, control.initial]),
    );
  }
  return props;
}
