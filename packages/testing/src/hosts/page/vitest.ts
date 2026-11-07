// What a build for the page host resolves `vitest` to, so one spec text serves both runners until
// the cutover: only what the corpus imports from it, and no hooks, which a spec never registers
// (the spec rules).
import { host } from "../../browser/host.ts";
import type { HarnessProvided } from "../../harness.ts";

export { it, test } from "../../browser/spec.ts";
export { expect } from "./expect.ts";

/** `describe`, through the host. */
export function describe(name: string, fn: () => void): void {
  host().describe(name, fn);
}

/** `inject`, through the host. */
export function inject<K extends keyof HarnessProvided>(key: K): HarnessProvided[K] {
  return host().inject(key);
}
