// A local cache of the verdicts `tsc` gives a type probe, so a repeat run of the analyser's tests
// skips the few seconds a run of `tsc` costs. CI never reads it: there, and with
// `UF_TYPES_CACHE=0`, every run checks the probe again. An entry's key covers everything that
// decides a verdict, so any change to the probe or to the types it reads misses.
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { isCI } from "./property.ts";

type Env = Readonly<Record<string, string | undefined>>;

/** Everything that decides what `tsc` reports for a probe. */
export interface ProbeInputs {
  /** The probe's source. */
  readonly probe: string;
  /** The `tsconfig.json` it is checked with. */
  readonly tsconfig: string;
  /** The TypeScript version, the folder it runs from and the flags it runs with. */
  readonly typescript: string;
  /**
   * The other files the probe reads, as text: the typed libraries' resolved folders (whose pnpm
   * paths carry their versions and patch hashes), the lockfile, and local type sources.
   */
  readonly files: readonly string[];
}

/** The cache key of a probe: a hash of every input, each length-prefixed so none runs into the next. */
export function probeKey(inputs: ProbeInputs): string {
  const hash = createHash("sha256");
  for (const part of [inputs.probe, inputs.tsconfig, inputs.typescript, ...inputs.files]) {
    hash.update(`${Buffer.byteLength(part)}:`).update(part);
  }
  return hash.digest("hex");
}

/** Whether the cache is used: never in CI, nor with `UF_TYPES_CACHE=0`. */
export function cacheEnabled(env: Env = process.env): boolean {
  const value = env.UF_TYPES_CACHE?.trim();
  return !isCI(env) && value !== "0" && value !== "false";
}

/** The entries kept: a run writes two, and an older checkout's stay until newer ones push them out. */
const KEPT = 8;

/** A cache of probe verdicts in `directory`, one file per key, with a checksum of its text. */
export interface ProbeCache {
  readonly read: (key: string) => string | undefined;
  readonly write: (key: string, output: string) => void;
}

const checksum = (text: string): string => createHash("sha256").update(text).digest("hex");

export function probeCache(directory: string, env: Env = process.env): ProbeCache {
  if (!cacheEnabled(env)) return { read: () => undefined, write: () => {} };
  const file = (key: string) => join(directory, `${key}.txt`);
  return {
    read(key) {
      let text: string;
      try {
        text = readFileSync(file(key), "utf8");
      } catch {
        return undefined;
      }
      // A torn or edited entry is a miss, never a verdict.
      const newline = text.indexOf("\n");
      const output = text.slice(newline + 1);
      return newline > 0 && text.slice(0, newline) === checksum(output) ? output : undefined;
    },
    write(key, output) {
      mkdirSync(directory, { recursive: true });
      // Written whole, then renamed, so a concurrent run reads the old entry or the new one.
      const temporary = `${file(key)}.${process.pid}.${crypto.randomUUID()}.tmp`;
      writeFileSync(temporary, `${checksum(output)}\n${output}`);
      renameSync(temporary, file(key));
      prune(directory);
    },
  };
}

/** Removes all but the newest entries. Another run may remove one first, which is fine. */
function prune(directory: string): void {
  const entries = readdirSync(directory)
    .filter((name) => name.endsWith(".txt"))
    .flatMap((name) => {
      try {
        return [{ name, time: statSync(join(directory, name)).mtimeMs }];
      } catch {
        return [];
      }
    })
    .toSorted((a, b) => b.time - a.time);
  for (const { name } of entries.slice(KEPT)) {
    try {
      unlinkSync(join(directory, name));
    } catch {
      // Already gone.
    }
  }
}
