// The Solid 2 quarantine (ADR-0057, ADR-0102): Solid 2's known failures, each with its reason and
// issue. Only entries whose target is "solid2" belong here, so each target lane edits its own file.
import type { QuarantineEntry } from "@unframework.dev/testing/node";

export const QUARANTINE: readonly QuarantineEntry[] = [];
