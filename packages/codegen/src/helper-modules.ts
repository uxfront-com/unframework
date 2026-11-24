// Shared helper modules (ADR-0121): a helper a target emits for a missing primitive lives in one
// module per helper, in the output tree's `_unframework/` directory, and each output that uses it
// imports it by a relative path. A helper's text depends only on the target and the helper, so
// every compile that emits it writes the same file, and each place that merges trees (the CLI's
// tree, the harness's case tree, the unplugin's virtual id) keeps one copy of it.
import type { EmitContext, OutputFile } from "./target.ts";

/** The directory at the root of each output tree that holds the helper modules (ADR-0121). */
export const HELPER_DIRECTORY = "_unframework";

/** The helper modules one target emits for one compile, collected as it emits them. */
export interface HelperModules {
  /** What a target's {@link EmitContext.helper} calls. */
  helper: NonNullable<EmitContext["helper"]>;
  /** Every helper module put so far, sorted by path (P8). */
  files(): OutputFile[];
}

/**
 * Collects the helper modules a target puts through {@link EmitContext.helper}. `base` is the
 * directory that holds `_unframework/`, relative to the output files' own directory, with forward
 * slashes: `""` for the source's directory, or `"../.."` for a tree two directories up. A file name
 * that leaves `_unframework/`, and one file given two texts, throw: either is a target's bug.
 */
export function createHelperModules(base = ""): HelperModules {
  const root = segments(base);
  if (root.some((part) => part !== "..")) {
    throw new TypeError(`The helper modules' base must be a parent directory, not "${base}".`);
  }
  const modules = new Map<string, string>();
  return {
    helper(file, contents, from) {
      // A name, in `_unframework/` itself: the unplugin's ids put only the target's directory there.
      if (!/^[\w$-][\w$.-]*\.[a-z]+$/i.test(file)) {
        throw new TypeError(
          `A helper module's file must be a file name in ${HELPER_DIRECTORY}/, such as "cx.ts", not "${file}".`,
        );
      }
      const path = [...root, HELPER_DIRECTORY, file].join("/");
      const known = modules.get(path);
      if (known !== undefined && known !== contents) {
        throw new Error(
          `The helper module ${path} was given two different texts: a helper's text must depend only on the target and the helper (ADR-0121).`,
        );
      }
      modules.set(path, contents);
      return specifierOf(path, from);
    },
    files: () =>
      [...modules.keys()].toSorted().map((path) => ({ path, contents: modules.get(path)! })),
  };
}

/** A path's parts, without the empty and `.` ones. */
function segments(path: string): string[] {
  return path.split("/").filter((part) => part !== "" && part !== ".");
}

/** The relative specifier an output at `from` imports `path` by, both relative to one directory. */
function specifierOf(path: string, from: string): string {
  const directory = segments(from).slice(0, -1);
  const target = segments(path);
  let shared = 0;
  while (
    shared < directory.length &&
    shared < target.length - 1 &&
    directory[shared] === target[shared] &&
    directory[shared] !== ".."
  ) {
    shared++;
  }
  const up = directory.slice(shared).map(() => "..");
  const relative = [...up, ...target.slice(shared)].join("/");
  return relative.startsWith("../") ? relative : `./${relative}`;
}
