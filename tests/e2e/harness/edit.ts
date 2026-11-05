import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Edit = (file: string, from: string, to: string) => void;

export interface Editor {
  edit: Edit;
  restore(): void;
}

/** Edits files under `root` for a hot-update test, and remembers what to put back. */
export function createEditor(root: string): Editor {
  const originals = new Map<string, string>();
  return {
    edit(file, from, to) {
      const path = join(root, file);
      const source = readFileSync(path, "utf8");
      // An edit that changes nothing would leave a test waiting for an update that never comes.
      if (!source.includes(from)) throw new Error(`${file} does not contain "${from}".`);
      if (!originals.has(path)) originals.set(path, source);
      // A function, because `$` in a replacement string is a pattern.
      writeFileSync(
        path,
        source.replace(from, () => to),
      );
    },
    restore() {
      for (const [path, source] of originals) writeFileSync(path, source);
      originals.clear();
    },
  };
}
