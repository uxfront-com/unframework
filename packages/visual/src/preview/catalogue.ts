// What the preview lists (ADR-0088): the project's examples, as `unframework visual` finds them,
// and its components, the default export of each `.uf.tsx` file under `srcDir`, with the
// controls their props get. Read once, when the preview starts.
import { globSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import { createFileResolver, createSyntacticOracle } from "@unframework.dev/compiler";

import { discoverExamples, EXAMPLE_SUFFIX, SKIPPED_DIRECTORIES } from "../examples.ts";
import { propControls } from "./controls.ts";
import type { PropControls } from "./controls.ts";

/** A component's file suffix. */
const COMPONENT_SUFFIX = ".uf.tsx";

/** One entry the shell can select: an example, or a component with its controls. */
export type PreviewEntry =
  | { kind: "example"; id: string; file: string }
  | ({ kind: "component"; id: string; file: string; name: string } & PropControls);

/** What the shell lists, in order: the examples, then the components, each sorted by id. */
export interface PreviewCatalogue {
  examples: Extract<PreviewEntry, { kind: "example" }>[];
  components: Extract<PreviewEntry, { kind: "component" }>[];
}

/** Reads a file, or gives `undefined` for one that does not exist, as the resolver asks. */
const read = (path: string): Promise<string | undefined> =>
  readFile(path, "utf8").catch(() => undefined);

/** The id of a file: its path from the root, with forward slashes, without its suffix. */
function idOf(root: string, file: string, suffix: string): string {
  return relative(root, file).split(sep).join("/").slice(0, -suffix.length);
}

/**
 * Every `.uf.tsx` file under `srcDir` but the examples, sorted by id, skipping the directories
 * discovery skips (`node_modules`, `dist` and dot directories).
 */
export function discoverComponentFiles(srcDir: string): string[] {
  const entries = globSync(`**/*${COMPONENT_SUFFIX}`, {
    cwd: srcDir,
    withFileTypes: true,
    exclude: (entry) => SKIPPED_DIRECTORIES.includes(entry.name) || entry.name.startsWith("."),
  });
  return entries
    .filter((entry) => !entry.isDirectory() && !entry.name.endsWith(EXAMPLE_SUFFIX))
    .map((entry) => resolve(entry.parentPath, entry.name))
    .toSorted();
}

/**
 * The catalogue of a project. A component is a file's default export, since an Astro output module
 * holds one component; a file with none, or one that does not compile, is left out, and the
 * project's own `unframework check` says why.
 */
export async function readCatalogue(root: string, srcDir: string): Promise<PreviewCatalogue> {
  const examples = discoverExamples({ root }).map((example) => ({
    kind: "example" as const,
    id: example.id,
    file: example.file,
  }));
  // The syntactic oracle reads the types a prop imports, so an alias resolves to its literals.
  const typeOracle = createSyntacticOracle({ root, readFile: read });
  const resolver = createFileResolver({ root, readFile: read, typeOracle });
  const components: PreviewCatalogue["components"] = [];
  try {
    for (const file of discoverComponentFiles(srcDir)) {
      const path = relative(root, file).split(sep).join("/");
      // The resolver reads a child's API for an importer: a file at the root imports this one.
      const specifier = path.startsWith(".") ? path : `./${path}`;
      const api = await resolver({ specifier, importer: "preview.uf.tsx" }).catch(() => undefined);
      const component = api?.components.find((each) => each.export === "default");
      if (!component) continue;
      components.push({
        kind: "component",
        id: idOf(root, file, COMPONENT_SUFFIX),
        file,
        name: component.name,
        ...propControls(component.props),
      });
    }
  } finally {
    await typeOracle.dispose();
  }
  return { examples, components };
}
