// The module id scheme (the virtual-ids ADR): an import of `X.uf.tsx` loads under the absolute
// path of the file plus the target's native extension, so the framework's own Vite plugin claims
// the module by extension and compiles the code the unframework plugin returns from `load`.
import { posix } from "node:path";

import type { Target } from "@unframework/codegen";
import { builtinTargets, TARGET_NAMES } from "@unframework/compiler";
import type { TargetName } from "@unframework/compiler";

/** The extension of an authored component file. */
export const SOURCE_EXTENSION = ".uf.tsx";

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * What `resolveId` looks at, with any query: the module ids of `suffix` coming back, and every
 * specifier that can name a `.uf.tsx` file. That is `X.uf.tsx` itself and the forms TypeScript
 * and Vite's resolver map to it: `X.uf` (extensionless, `moduleResolution: "bundler"`) and
 * `X.uf.js` or `X.uf.jsx` (what `"nodenext"` requires). Whether a specifier is a component is
 * decided by the file it resolves to, never by its spelling: `X.uf` may be a composable, `X.uf.ts`.
 */
export function specifierFilter(suffix: string): RegExp {
  return new RegExp(`\\.uf(?:\\.tsx(?:${escapeRegExp(suffix)})?|\\.jsx?)?(?:\\?.*)?$`);
}

/** The module ids of `suffix`, with any query. */
export function moduleIdFilter(suffix: string): RegExp {
  return new RegExp(`${escapeRegExp(`${SOURCE_EXTENSION}${suffix}`)}(?:\\?.*)?$`);
}

/**
 * What each built-in target appends to the absolute `.uf.tsx` path to form its module ids.
 * React, Solid and Qwik keep the `.tsx` id, which their plugins claim. Vue, Svelte and Astro
 * claim `.vue`, `.svelte` and `.astro`. Angular output is TypeScript, and Analog only claims
 * `.ts` (`/\.[cm]?ts(?![a-z])/`), so its ids end in `.uf.tsx.ts`.
 */
export const ID_SUFFIXES: Readonly<Record<TargetName, string>> = {
  react: "",
  vue: ".vue",
  svelte: ".svelte",
  solid: "",
  angular: ".ts",
  qwik: "",
  astro: ".astro",
};

/**
 * The prefix of the id a `.uf.tsx` import resolves to during Vite's dependency scan. The
 * scanner reads whatever id it gets from disk with its own loaders, so a module id that only
 * `load` can produce fails the whole scan, and the authored file would expose its compile-time
 * imports (`unframework`, or a rejected framework import) as dependencies to pre-bundle. The
 * scanner externalises ids that contain `\0` and never loads them. Each target's toolchain
 * lists the runtime imports of its compiled output in `optimizeDeps.include` instead.
 */
export const SCAN_ID_PREFIX = "\0uf-scan:";

// "" keeps the `.uf.tsx` id; otherwise one or more dot-separated extensions, such as ".vue".
const EXTENSION = /^(?:\.[\w-]+)*$/;

/**
 * The id suffix for a target: `extension` when given, otherwise the built-in target's suffix.
 * A third-party target has no built-in suffix, so it must name the extension its framework's
 * Vite plugin claims.
 */
export function idSuffix(target: TargetName | Target, extension?: string): string {
  if (extension !== undefined) {
    if (!EXTENSION.test(extension)) {
      throw new TypeError(
        `The extension ${JSON.stringify(extension)} is not a file extension: use "" to keep the .uf.tsx id, or a suffix such as ".vue".`,
      );
    }
    return extension;
  }
  if (typeof target === "string") {
    if (!Object.hasOwn(ID_SUFFIXES, target)) throw new TypeError(`Unknown target "${target}".`);
    return ID_SUFFIXES[target];
  }
  const builtin = TARGET_NAMES.find((name) => builtinTargets[name] === target);
  if (builtin === undefined) {
    throw new TypeError(
      `The "${target.name}" target is not built in, so its module ids need an explicit \`extension\`: the file extension its framework's Vite plugin claims, such as ".vue", or "" to keep the .uf.tsx id.`,
    );
  }
  return ID_SUFFIXES[builtin];
}

/** The module id that loads `file` (an absolute `.uf.tsx` path) for an id suffix. */
export function moduleId(file: string, suffix: string, query = ""): string {
  return `${file}${suffix}${query}`;
}

/** A module id taken apart. */
export interface ModuleRequest {
  /** The authored `.uf.tsx` file. */
  file: string;
  /** The query, with its `?`, or `""`. */
  query: string;
}

/**
 * Takes a module id for an id suffix apart, or returns `undefined` when the id is not one.
 * The query is not part of the match, so `X.uf.tsx.vue?vue&type=style&index=0&lang.css` is
 * recognised; whether a query belongs to the plugin is the caller's decision.
 */
export function parseModuleId(id: string, suffix: string): ModuleRequest | undefined {
  const index = id.indexOf("?");
  const path = index === -1 ? id : id.slice(0, index);
  if (!path.endsWith(`${SOURCE_EXTENSION}${suffix}`)) return undefined;
  return {
    file: path.slice(0, path.length - suffix.length),
    query: index === -1 ? "" : id.slice(index),
  };
}

// An absolute path with a drive letter, as Vite writes ids on Windows: `C:/project/X.uf.tsx.vue`.
const DRIVE_PATH = /^[A-Za-z]:\//;

/**
 * The absolute ids a module id that comes back to `resolveId` (its path, without the query) may
 * stand for, most likely first; the caller keeps the first whose `.uf.tsx` file exists.
 *
 * - `./X.uf.tsx.vue` and `../X.uf.tsx.vue` are relative to their importer.
 * - `/X.uf.tsx.vue` is a root-relative URL from the browser, or, outside the root, an absolute id.
 * - `C:/X.uf.tsx.vue` is an absolute id on Windows.
 *
 * Paths join with forward slashes, as Vite writes ids on every platform (and its root), so one
 * module never gets a second id that differs only in its separators. A bare specifier names a
 * package, never one of these ids.
 */
export function moduleIdCandidates(
  path: string,
  root: string,
  importer: string | undefined,
): string[] {
  if (path.startsWith("./") || path.startsWith("../")) {
    if (importer === undefined) return [];
    const index = importer.indexOf("?");
    const importerPath = index === -1 ? importer : importer.slice(0, index);
    return [posix.join(posix.dirname(importerPath), path)];
  }
  if (path.startsWith(`${root}/`)) return [path];
  if (path.startsWith("/")) return [posix.join(root, path), path];
  return DRIVE_PATH.test(path) ? [path] : [];
}

/**
 * A component id (ADR-0053): `<abs>/X.uf.tsx.<output file>`, such as `/src/Card.uf.tsx.CardIcon.vue`,
 * which loads a component of the file other than its main one, under the extension its
 * framework's plugin claims. A main id's suffix is an extension alone (`.vue`), with no dot in it.
 */
const COMPONENT_ID = /\.uf\.tsx\.([^/?]+\.[^/.?]+)(?:\?.*)?$/;

/** What `resolveId` and `load` look at for component ids, with any query. */
export const COMPONENT_ID_FILTER: RegExp = COMPONENT_ID;

/** The component id of `output`, a file the target emits for a component of `file`. */
export function componentId(file: string, output: string, query = ""): string {
  return `${file}.${output}${query}`;
}

/** A component id taken apart, or `undefined` when the id is not one. */
export function parseComponentId(
  id: string,
): { file: string; output: string; query: string } | undefined {
  const match = COMPONENT_ID.exec(id);
  if (!match) return undefined;
  const index = id.indexOf("?");
  const path = index === -1 ? id : id.slice(0, index);
  const output = match[1]!;
  return {
    file: path.slice(0, path.length - output.length - 1),
    output,
    query: index === -1 ? "" : id.slice(index),
  };
}
