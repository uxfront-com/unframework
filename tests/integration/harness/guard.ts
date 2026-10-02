// The golden guard (plan §7.3, the virtual-ids ADR): "the browser tests run the reviewed code".
// Every module the unplugin compiles in an ssr or browser project must equal the committed
// golden files of its case and target; otherwise the module fails with the difference, and the
// spec that imports it fails before it mounts.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

import { diffLines } from "@unframework/testing/node";
import type { CompileEvent } from "@unframework/unplugin/vite";

import { ROOT } from "./paths.ts";

/**
 * Compares a compile's files with `__output__/<target>/` next to the `.uf.tsx`. Returns the
 * failure message, or nothing when the files match exactly (no missing, extra or different file).
 * Paths in the message are relative to `root`.
 */
export function goldenGuard(
  event: Pick<CompileEvent, "file" | "target" | "files">,
  root: string = ROOT,
): string | undefined {
  const directory = join(dirname(event.file), "__output__", event.target);
  const rel = (path: string) => relative(root, path).split(sep).join("/");
  const golden = existsSync(directory) ? listFiles(directory) : [];
  const produced = new Map(event.files.map((file) => [file.path, file.contents]));
  const problems: string[] = [];
  for (const path of golden) {
    if (!produced.has(path))
      problems.push(`${rel(join(directory, path))} is not produced by the compiler.`);
  }
  for (const [path, contents] of produced) {
    const file = join(directory, path);
    if (!existsSync(file)) {
      problems.push(`${rel(file)} is missing.`);
      continue;
    }
    const expected = readFileSync(file, "utf8");
    if (expected !== contents)
      problems.push(`${rel(file)} differs:\n${diffLines(expected, contents)}`);
  }
  if (!problems.length) return undefined;
  return [
    `[uf guard] The ${event.target} output of ${rel(event.file)} is not its golden output:`,
    ...problems,
    "Run the compile project in update mode (`pnpm test:update`) and review the diff.",
  ].join("\n");
}

function listFiles(directory: string): string[] {
  return (readdirSync(directory, { recursive: true }) as string[])
    .filter((entry) => statSync(join(directory, entry)).isFile())
    .map((entry) => entry.split(sep).join("/"))
    .sort();
}
