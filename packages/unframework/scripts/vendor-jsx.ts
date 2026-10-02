/**
 * Re-vendors the JSX element types that `unframework/jsx-runtime` is built on (ADR-0017).
 *
 *   pnpm --filter unframework vendor:jsx         rewrite src/vendor/vue-jsx.d.ts from the installed upstream
 *   pnpm --filter unframework vendor:jsx --check fail if src/vendor/vue-jsx.d.ts has drifted
 *
 * The upstream is `@vue/runtime-dom`, pinned exactly in this package's devDependencies. It ships no
 * separate JSX file: `src/jsx.ts` is rolled up into `dist/runtime-dom.d.ts`, so this script cuts one
 * contiguous region out of that file (from `export interface CSSProperties` to the end of
 * `export type NativeElements`) and writes it unchanged below a generated header. The body is never
 * edited by hand: every reshaping happens in `src/jsx-upstream.ts` (the owned alias) and
 * `src/jsx-runtime.ts`.
 *
 * To move to a new upstream: bump the exact devDependency, install, run this script, read the diff,
 * then run the probes (`pnpm --filter unframework test`), which pin what the surface catches.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Where the JSX types come from, and the file in that package holding them. */
export const UPSTREAM: { readonly package: string; readonly file: string } = {
  package: "@vue/runtime-dom",
  file: "dist/runtime-dom.d.ts",
};

/** The vendored copy. Only `src/jsx-upstream.ts` imports it. */
export const VENDORED_FILE: string = fileURLToPath(
  new URL("../src/vendor/vue-jsx.d.ts", import.meta.url),
);

const START = /^export interface CSSProperties\b/;
const END_DECLARATION = /^export type NativeElements = \{/;
/** The region must stay self-contained apart from the two names the prelude supplies. */
const BANNED = ["import ", "declare module", "@vue/"];

/** Supplies the identifiers the region uses but does not declare. */
const PRELUDE = [
  `import type * as CSS from "csstype";`,
  `/** Stand-in for @vue/runtime-core's VNodeRef. Only \`ReservedProps\` uses it, and unframework does not. */`,
  `type VNodeRef = unknown;`,
].join("\n");

/** Everything the vendored file is derived from, read from the installed upstream. */
export interface UpstreamSnapshot {
  /** The installed version (`package.json#version`). */
  version: string;
  /** The specifier in this package's devDependencies; it must equal `version`. */
  pinned: string | undefined;
  /** The SPDX licence (`package.json#license`). */
  license: string;
  /** The text of `UPSTREAM.file`. */
  declarations: string;
  /** The text of the upstream LICENSE file, copied into the header. */
  licenceText: string;
}

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/** Reads the installed upstream and this package's pin for it. */
export function readUpstream(): UpstreamSnapshot {
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve(`${UPSTREAM.package}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    version: string;
    license: string;
  };
  const own = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    devDependencies?: Record<string, string>;
  };
  const root = dirname(manifestPath);
  return {
    version: manifest.version,
    pinned: own.devDependencies?.[UPSTREAM.package],
    license: manifest.license,
    declarations: readFileSync(join(root, UPSTREAM.file), "utf8"),
    licenceText: readFileSync(join(root, "LICENSE"), "utf8"),
  };
}

/**
 * Renders `src/vendor/vue-jsx.d.ts`. Throws, rather than writing something plausible, when the pin
 * is not exact or the upstream has changed shape: either needs a person to read the upstream diff.
 */
export function renderVendoredJsx(upstream: UpstreamSnapshot): string {
  if (upstream.pinned !== upstream.version) {
    throw new Error(
      `${UPSTREAM.package}: installed ${upstream.version}, pinned ${upstream.pinned ?? "nothing"}. ` +
        "Pin it exactly in devDependencies and reinstall.",
    );
  }
  const copyright = upstream.licenceText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^copyright/i.test(line));
  if (!copyright) throw new Error(`${UPSTREAM.package}: no Copyright line in its LICENSE`);

  const lines = upstream.declarations.split("\n");
  const start = lines.findIndex((line) => START.test(line));
  const endDeclaration = lines.findIndex((line) => END_DECLARATION.test(line));
  const end = lines.findIndex((line, index) => index > endDeclaration && line === "};");
  if (start < 0 || endDeclaration < start || end < 0) {
    throw new Error(
      `${UPSTREAM.package}: could not find the JSX region in ${UPSTREAM.file}; the upstream changed shape`,
    );
  }
  const body = `${lines.slice(start, end + 1).join("\n")}\n`;
  for (const banned of BANNED) {
    if (body.includes(banned)) {
      throw new Error(
        `${UPSTREAM.package}: the JSX region now contains \`${banned}\`; review the upstream change`,
      );
    }
  }

  const notice = upstream.licenceText
    .trimEnd()
    .split("\n")
    .map((line) => (line.trim() ? ` *   ${line}` : " *"))
    .join("\n");
  const header = `/* eslint-disable */
// oxlint-disable -- vendored verbatim, see below.
/**
 * VENDORED - DO NOT EDIT BY HAND. Regenerate with \`pnpm --filter unframework vendor:jsx\`.
 *
 * Upstream: ${UPSTREAM.package}@${upstream.version}, ${UPSTREAM.file} lines ${start + 1}-${end + 1}
 *           (the rolled-up form of vuejs/core packages/runtime-dom/src/jsx.ts)
 * Upstream file sha256: ${sha256(upstream.declarations)}
 * Body sha256:          ${sha256(body)} (no local changes)
 * Licence:  ${upstream.license}. ${copyright}. The upstream notice travels with the copy:
 *
${notice}
 *
 * Only src/jsx-upstream.ts may import this file. It is the owned alias: swap the upstream there.
 */
${PRELUDE}

`;
  return header + body;
}

if (import.meta.main) {
  const output = renderVendoredJsx(readUpstream());
  if (process.argv.includes("--check")) {
    if (readFileSync(VENDORED_FILE, "utf8") !== output) {
      console.error(
        `vendor-jsx: ${VENDORED_FILE} has drifted from ${UPSTREAM.package}. ` +
          "Run `pnpm --filter unframework vendor:jsx` and review the diff.",
      );
      process.exit(1);
    }
    console.log("vendor-jsx: up to date");
  } else {
    writeFileSync(VENDORED_FILE, output);
    console.log(`vendor-jsx: wrote ${VENDORED_FILE} (${output.split("\n").length} lines)`);
  }
}
