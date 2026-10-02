// What the harness provides to its own projects, besides `target` and `ufHarness` (declared by
// @unframework/testing).
import type {} from "@unframework/testing/node";

declare module "vitest" {
  interface ProvidedContext {
    /** ssr projects: the module specifier of the target's renderer (`toolchain.server`). */
    ufServer: string;
    /** A project whose setup failed (its toolchain did not load): why, and which layers it owes. */
    ufUnavailable: { project: string; layers: string[]; message: string };
  }
}
