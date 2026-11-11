import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach } from "vitest";

import { main } from "../src/index.ts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** A throwaway project holding `files`, by their paths relative to it. */
export function project(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), "uf-cli-"));
  roots.push(root);
  write(root, files);
  return root;
}

export function write(root: string, files: Readonly<Record<string, string>>): void {
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
}

/** Runs a command line in `root`. */
export async function run(
  root: string,
  ...argv: string[]
): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  const code = await main(argv, {
    cwd: root,
    stdout: (text) => void (stdout += text),
    stderr: (text) => void (stderr += text),
  });
  return { code, stdout, stderr };
}

/** Every file under `directory`, by its sorted path relative to it. */
export function tree(directory: string): Record<string, string> {
  const entries = readdirSync(directory, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(directory.length + 1))
    .toSorted();
  return Object.fromEntries(
    files.map((file) => [file, readFileSync(join(directory, file), "utf8")]),
  );
}
