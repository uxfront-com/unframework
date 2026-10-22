// The Qwik quarantine (ADR-0057): Qwik's known failures, each with its reason and issue. Only
// entries whose target is "qwik" belong here, so each target lane edits its own file.
import type { QuarantineEntry } from "@unframework/testing/node";

/** Empty: every live layer is green on Qwik. */
export const QUARANTINE: readonly QuarantineEntry[] = [];
