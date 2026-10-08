// The Svelte quarantine (ADR-0057): Svelte's known failures, each with its reason and issue. Only
// entries whose target is "svelte" belong here, so each target lane edits its own file.
import type { QuarantineEntry } from "@unframework/testing/node";

/** Empty: every live layer is green on Svelte. */
export const QUARANTINE: readonly QuarantineEntry[] = [];
