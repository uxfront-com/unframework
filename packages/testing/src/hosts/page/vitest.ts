// What a build for the page host resolves `vitest` to, so one spec text serves both runners until
// the cutover: what the corpus and the stub specs import from it, and no hooks, which a corpus spec
// never registers (the spec rules).
import { host } from "../../browser/host.ts";
import type { HarnessProvided } from "../../harness.ts";

export { it } from "../../browser/spec.ts";
export { expect } from "./expect.ts";

/** `inject`, through the host, which the stub specs read. */
export function inject<K extends keyof HarnessProvided>(key: K): HarnessProvided[K] {
  return host().inject(key);
}
