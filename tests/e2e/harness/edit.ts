import { EventEmitter } from "node:events";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import { stripVTControlCharacters } from "node:util";

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

/** What a watcher reports when it knows that the server has caught up, but not on which file. */
const ANY_FILE = "*";

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
      if (changed !== path && changed !== ANY_FILE) return;
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

// What `ng serve` prints at the end of every rebuild, whether or not its output changed. It then
// swaps in the new files and tells the clients, within the settle time a write waits past this.
const REBUILT = /Application bundle generation (?:complete|failed)/;

/**
 * The `Watcher` of a dev server in another process, whose own watcher can't be reached. It reports
 * the end of each rebuild, as a change to any file: a rebuild only runs once the server has seen a
 * write, and until it ends a page still loads the old bundle. So write one edit at a time, because
 * a file written during a rebuild is reported when that rebuild ends.
 */
export function rebuildWatcher(output: Readable): Watcher {
  const events = new EventEmitter();
  createInterface({ input: output }).on("line", (line) => {
    if (REBUILT.test(stripVTControlCharacters(line))) events.emit("change", ANY_FILE);
  });
  return {
    on: (event, listener) => events.on(event, listener),
    off: (event, listener) => events.off(event, listener),
  };
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
