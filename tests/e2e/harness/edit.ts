import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Edit = (file: string, from: string, to: string) => Promise<void>;

export interface Editor {
  edit: Edit;
  restore(): Promise<void>;
}

/** The part of a dev server's file watcher the editor uses. */
export interface Watcher {
  on(event: "change", listener: (path: string) => void): unknown;
  off(event: "change", listener: (path: string) => void): unknown;
}

// A page that loads before the dev server has seen a write gets the old transform, and can keep
// it, because the update comes before the page is ready for it. So a write waits for its event,
// and this long past it: Vite invalidates after an await in its own listener, and chokidar drops
// a second change to a file within 50ms of the first.
const SETTLE_MS = 50;

/** Writes a file and waits for the dev server to notice. */
function write(watcher: Watcher, path: string, source: string, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const stop = (): void => {
      clearTimeout(timer);
      watcher.off("change", onChange);
    };
    const onChange = (changed: string): void => {
      if (changed !== path) return;
      stop();
      setTimeout(resolve, SETTLE_MS);
    };
    const timer = setTimeout(() => {
      stop();
      reject(new Error(`The dev server never reported a change to ${path}.`));
    }, timeout);
    // Before the write, and in one tick, so the event can't come first and any event seen follows it.
    watcher.on("change", onChange);
    writeFileSync(path, source);
  });
}

/** Edits files under `root` for a hot-update test, and remembers what to put back. */
export function createEditor(root: string, watcher: Watcher, timeout: number = 5000): Editor {
  const originals = new Map<string, string>();
  return {
    async edit(file, from, to) {
      const path = join(root, file);
      const source = readFileSync(path, "utf8");
      // An edit that changes nothing would leave a test waiting for an update that never comes.
      if (!source.includes(from)) throw new Error(`${file} does not contain "${from}".`);
      if (!originals.has(path)) originals.set(path, source);
      // A function, because `$` in a replacement string is a pattern.
      await write(
        watcher,
        path,
        source.replace(from, () => to),
        timeout,
      );
    },
    async restore() {
      const writes = [...originals].map(([path, source]) => write(watcher, path, source, timeout));
      originals.clear();
      await Promise.all(writes);
    },
  };
}
