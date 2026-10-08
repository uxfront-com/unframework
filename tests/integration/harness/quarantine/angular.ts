// The Angular quarantine (ADR-0057): Angular's known failures, each with its reason and issue. Only
// entries whose target is "angular" belong here, so each target lane edits its own file.
import type { QuarantineEntry } from "@unframework/testing/node";

/** Empty: every live layer is green on Angular. */
export const QUARANTINE: readonly QuarantineEntry[] = [];
