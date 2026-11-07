// What a Storybook build leaves beside its output, for the run that drives it: each main module's
// events, which a mount listens to, from the modules the build compiled (ADR-0050), and the modules
// it could not build. A file in place of the in-process store (`./events.ts`), since the build and
// the run are separate processes.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { MountEvent } from "@unframework/codegen";

/** The manifest's file name in a build's output directory. */
export const BUILD_MANIFEST = "uf-build-manifest.json";

/** A main module's events, or why they cannot be told (`eventsOfModule` threw). */
export type BuildManifestModule = { events: MountEvent[] } | { error: string };

/** A module the build turned into one that throws. */
export interface BuildFailure {
  /** The module id. */
  module: string;
  /** What failed it. */
  cause: string;
}

/** What a manifest holds. */
export interface BuildManifest {
  /** The target the build compiled to. */
  target: string;
  /** The Vite root the build ran in. */
  root: string;
  /** Each main module, by the absolute path of its `.uf.tsx` file. */
  modules: Record<string, BuildManifestModule>;
  failures: BuildFailure[];
}

/** Writes a build's manifest, its modules and failures sorted, so two equal builds write one text. */
export function writeBuildManifest(directory: string, manifest: BuildManifest): void {
  const modules = Object.fromEntries(
    Object.entries(manifest.modules).toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  const failures = manifest.failures.toSorted((a, b) => {
    const [first, second] = [`${a.module}\0${a.cause}`, `${b.module}\0${b.cause}`];
    return first < second ? -1 : first > second ? 1 : 0;
  });
  writeFileSync(
    join(directory, BUILD_MANIFEST),
    `${JSON.stringify({ ...manifest, modules, failures }, null, 2)}\n`,
  );
}

/** Reads a build's manifest. Throws when the build wrote none. */
export function readBuildManifest(directory: string): BuildManifest {
  const file = join(directory, BUILD_MANIFEST);
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    throw new Error(`No build manifest at ${file}: build the Storybook first.`, { cause: error });
  }
  return JSON.parse(text) as BuildManifest;
}

/** The events a main module declares. Throws for a module the build did not compile, or can't say. */
export function manifestEvents(manifest: BuildManifest, file: string): MountEvent[] {
  const entry = manifest.modules[file];
  if (!entry) {
    throw new Error(`[uf] The ${manifest.target} build compiled no main module ${file}.`);
  }
  if ("error" in entry) throw new Error(entry.error);
  return entry.events;
}
