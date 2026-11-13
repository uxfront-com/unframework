// What the harness provides to its own projects, besides `target` and `ufHarness` (declared by
// @unframework.dev/testing).
import type {} from "@unframework.dev/testing/node";

declare module "vitest" {
  interface ProvidedContext {
    /** A project whose setup failed (its toolchain did not load): why, and which layers it owes. */
    ufUnavailable: { project: string; layers: string[]; message: string };
    /** SSR projects: how many shard files run the project's renders (`ssrShardCount`). */
    ufSsrShards: number;
  }
}
