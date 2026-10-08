// The Vue quarantine (ADR-0057): Vue's known failures, each with its reason and issue. Only
// entries whose target is "vue" belong here, so each target lane edits its own file.
import type { QuarantineEntry } from "@unframework/testing/node";

/** Empty: every live layer is green on Vue. */
export const QUARANTINE: readonly QuarantineEntry[] = [];
