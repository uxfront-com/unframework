// A project's examples (plan §8.6, ADR-0087): `*.example.uf.tsx` files, each a component with no
// props, so every target renders it the same way with nothing to pass. Discovery skips installed
// packages, build output and the run's own directory, and UF7011 refuses an example with props.
import { globSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

import { compile, createFileResolver } from "@unframework.dev/compiler";
import type { Diagnostic } from "@unframework.dev/compiler";
import { createDiagnostic } from "@unframework.dev/diagnostics";
import { baselineFileName } from "@unframework.dev/testing/node";

/** An example's file suffix. */
export const EXAMPLE_SUFFIX = ".example.uf.tsx";

/** The directories discovery never enters, besides dot directories and the run's own. */
export const SKIPPED_DIRECTORIES: readonly string[] = ["node_modules", "dist"];

/** One example of a project. */
export interface Example {
  /**
   * The file's path relative to the project's root, with forward slashes and without the suffix:
   * `examples/Buttons` for `examples/Buttons.example.uf.tsx`. Unique in the project.
   */
  id: string;
  /** The file (absolute). */
  file: string;
  /** The file's name without the suffix, `Buttons`: its baselines are named after it. */
  name: string;
}

/** What {@link discoverExamples} reads. */
export interface DiscoverExamplesOptions {
  /** The project's root (absolute). */
  root: string;
  /** Directories (absolute) to skip besides the defaults: the run directory. */
  skip?: readonly string[];
}

/**
 * Every `*.example.uf.tsx` under the root, at any depth, sorted by id. It skips
 * `node_modules`, `dist`, dot directories (`.unframework/`, among them) and `skip`.
 */
export function discoverExamples(options: DiscoverExamplesOptions): Example[] {
  const root = resolve(options.root);
  const skipped = new Set((options.skip ?? []).map((directory) => resolve(directory)));
  const files = globSync(`**/*${EXAMPLE_SUFFIX}`, {
    cwd: root,
    exclude: (path) =>
      SKIPPED_DIRECTORIES.includes(basename(path)) || skipped.has(resolve(root, path)),
  });
  return files
    .map((file): Example => {
      const absolute = resolve(root, file);
      const id = relative(root, absolute).split(sep).join("/").slice(0, -EXAMPLE_SUFFIX.length);
      return { id, file: absolute, name: basename(absolute).slice(0, -EXAMPLE_SUFFIX.length) };
    })
    .toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Where an example's committed baselines live: beside it, as a case's lie in its directory. */
export interface ExampleBaselines {
  /** `<dir>/__screenshots__/<name>-chromium-linux.png`. */
  png: string;
  /** `<dir>/__expected__/geometry.<name>.json`. */
  geometry: string;
}

/** An example's baseline paths, beside its file. */
export function exampleBaselines(example: Pick<Example, "file" | "name">): ExampleBaselines {
  const directory = dirname(example.file);
  return {
    png: join(directory, "__screenshots__", baselineFileName(example.name)),
    geometry: join(directory, "__expected__", `geometry.${example.name}.json`),
  };
}

/**
 * Checks each example's default export: UF7011 at the props parameter of one that declares props.
 * An example that does not compile is left to the run, which reports its error on every target.
 * Throws for an example with no default export, which the run could not mount.
 */
export async function checkExamples(
  root: string,
  examples: readonly Example[],
): Promise<Diagnostic[]> {
  const read = (path: string) => readFile(path, "utf8").catch(() => undefined);
  const resolver = createFileResolver({ root, readFile: read });
  const diagnostics: Diagnostic[] = [];
  for (const example of examples) {
    const source = await readFile(example.file, "utf8");
    const filename = relative(root, example.file).split(sep).join("/");
    const { ir, diagnostics: errors } = await compile(source, {
      filename,
      targets: [],
      resolve: resolver,
    });
    if (!ir || errors.some((each) => each.severity === "error")) continue;
    const exported = ir.exports.find((entry) => entry.kind === "default");
    const component = ir.components.find((each) => each.name === exported?.local);
    if (!component) {
      throw new Error(
        `[uf] ${filename} has no default export: an example default-exports the component it shows, export default function ${example.name}() { … }.`,
      );
    }
    if (component.propsParameter) {
      diagnostics.push(
        createDiagnostic("UF7011", {
          file: filename,
          span: component.propsParameter.span,
          message: `The example ${component.name} declares props, which no target is given: an example renders with none.`,
          help: "Remove the props, and pass the values the example shows to the components it renders.",
        }),
      );
    }
  }
  return diagnostics;
}
