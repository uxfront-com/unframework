// The Angular quarantine (ADR-0057): Angular's known failures, each with its reason and issue. Only
// entries whose target is "angular" belong here, so each target lane edits its own file.
import type { QuarantineEntry } from "@unframework/testing/node";

/**
 * Chrome's accessible name puts a space at every `display: contents` element, and Angular's host
 * element is one (ADR-0010): two components rendered side by side as inline content read
 * "Build passing" where every other target reads "Buildpassing". The DOM, the pixels and the
 * behaviour match; the host strategy, or a declared difference, needs a decision.
 */
const HOST_NAME_SPACE =
  "Chrome's accessible name puts a space at Angular's `display: contents` host (ADR-0010) between inline siblings.";

export const QUARANTINE: readonly QuarantineEntry[] = [
  {
    case: "components/named-import",
    target: "angular",
    layer: "L7",
    reason: HOST_NAME_SPACE,
    issue: "UXF-318",
  },
  {
    case: "fallthrough/class-and-style",
    target: "angular",
    layer: "L7",
    reason: HOST_NAME_SPACE,
    issue: "UXF-318",
  },
  {
    case: "fallthrough/class-and-style",
    target: "angular",
    layer: "L9",
    reason: HOST_NAME_SPACE,
    issue: "UXF-318",
  },
];
