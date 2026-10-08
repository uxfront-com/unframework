// The Solid quarantine (ADR-0057): Solid's known failures, each with its reason and issue. Only
// entries whose target is "solid" belong here, so each target lane edits its own file.
import type { QuarantineEntry } from "@unframework/testing/node";

/** Empty: every live layer is green on Solid. */
export const QUARANTINE: readonly QuarantineEntry[] = [];
