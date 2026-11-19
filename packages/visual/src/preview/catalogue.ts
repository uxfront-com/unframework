// What the preview lists (ADR-0088): the project's examples, as `unframework visual` finds them,
// with the metadata their doc comments give (ADR-0110, ADR-0114), and its components, the default export of each `.uf.tsx` file under `srcDir`, with the
// controls their props get. Read once, when the preview starts.
import { globSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import { createFileResolver, createSyntacticOracle } from "@unframework.dev/compiler";
import type { Diagnostic } from "@unframework.dev/compiler";

import {
  discoverExamples,
  EXAMPLE_SUFFIX,
  readExampleMetadata,
  SKIPPED_DIRECTORIES,
} from "../examples.ts";
import type { Example } from "../examples.ts";
import { propControls } from "./controls.ts";
import type { PropControls } from "./controls.ts";
import type { PreviewLayout } from "./protocol.ts";

/** A component's file suffix. */
const COMPONENT_SUFFIX = ".uf.tsx";

/** One entry the shell can select: an example, or a component with its controls. */
export type PreviewEntry =
  | ({ kind: "example"; key: string; id: string; file: string } & Pick<
      Example,
      "category" | "title" | "description" | "order" | "layout"
    >)
  | ({ kind: "component"; key: string; id: string; file: string; name: string } & PropControls);

/**
 * The key the frames and the shell's URL name an entry by: its kind and its id, since an example
 * kept beside its component (`src/Card.example.uf.tsx`, `src/Card.uf.tsx`) has the component's id.
 */
export function entryKey(kind: PreviewEntry["kind"], id: string): string {
  return `${kind}:${id}`;
}

/**
 * What the shell lists, in order: the examples, sorted as {@link compareExamples} says, then the
 * components, sorted by id.
 */
export interface PreviewCatalogue {
  examples: Extract<PreviewEntry, { kind: "example" }>[];
  components: Extract<PreviewEntry, { kind: "component" }>[];
  /** UF7012 for each malformed tag in an example's doc comment: warnings, which the commands print. */
  diagnostics: Diagnostic[];
}

/** Code-unit order, the same on every machine (P8), unlike a locale's. */
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The examples' order (ADR-0110): by `order`, those without one last, then by title, then by id,
 * which is unique.
 */
export function compareExamples(
  a: Pick<Example, "id" | "title" | "order">,
  b: Pick<Example, "id" | "title" | "order">,
): number {
  const order = (a.order ?? Infinity) - (b.order ?? Infinity);
  if (order) return order;
  return byCodeUnit(a.title, b.title) || byCodeUnit(a.id, b.id);
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
  const metadata = await readExampleMetadata(root, discoverExamples({ root }));
  const examples = metadata.examples
    .toSorted(compareExamples)
    .map(
      ({
        id,
        file,
        category,
        title,
        description,
        order,
        layout,
      }): PreviewCatalogue["examples"][number] => ({
        kind: "example",
        key: entryKey("example", id),
        id,
        file,
        category,
        title,
        ...(description === undefined ? {} : { description }),
        ...(order === undefined ? {} : { order }),
        ...(layout === undefined ? {} : { layout }),
      }),
    );
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
      const id = idOf(root, file, COMPONENT_SUFFIX);
      components.push({
        kind: "component",
        key: entryKey("component", id),
        id,
        file,
        name: component.name,
        ...propControls(component.props),
      });
    }
  } finally {
    await typeOracle.dispose();
  }
  return { examples, components, diagnostics: metadata.diagnostics };
}

/** The layout of each example that sets one, by key, for the frames (ADR-0114). */
export function entryLayouts(catalogue: PreviewCatalogue): Record<string, PreviewLayout> {
  return Object.fromEntries(
    catalogue.examples.flatMap((entry) => (entry.layout ? [[entry.key, entry.layout]] : [])),
  );
}
