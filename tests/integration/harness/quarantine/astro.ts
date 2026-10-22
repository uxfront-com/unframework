// The Astro quarantine (ADR-0057): Astro's known failures, each with its reason and issue. Only
// entries whose target is "astro" belong here, so each target lane edits its own file.
import type { QuarantineEntry } from "@unframework/testing/node";

/** Empty: every live layer is green on Astro (ADR-0063). */
export const QUARANTINE: readonly QuarantineEntry[] = [];
