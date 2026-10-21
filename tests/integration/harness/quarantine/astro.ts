// The Astro quarantine (ADR-0057): Astro's known failures, each with its reason and issue. Only
// entries whose target is "astro" belong here, so each target lane edits its own file.
import type { LayerName, QuarantineEntry } from "@unframework/testing/node";

/**
 * The scoping corpus's cells that fail until Astro attaches the scoped sheet and its child's root
 * takes the parent's scope attribute (ADR-0063): Vue wrote their expectations first (M4 layer 6),
 * and Astro's M4 lane empties this list.
 */
const UNATTACHED: Readonly<Record<string, readonly LayerName[]>> = {
  "styles/child-root": ["L6", "L7", "L10"],
  "styles/child-root-branches": ["L6", "L7", "L10"],
  "styles/custom-properties": ["L10"],
  "styles/data-attribute-variants": ["L10"],
  "styles/deep": ["L6", "L7", "L10"],
  "styles/focus-visible": ["L10"],
  "styles/global": ["L6", "L7", "L10"],
  "styles/hover-state": ["L10"],
  "styles/keyframes": ["L10"],
  "styles/layers": ["L10"],
  "styles/media-queries": ["L10"],
  "styles/pseudo-elements": ["L7", "L10"],
  "styles/scoped-basics": ["L7", "L10"],
  "styles/slotted": ["L10"],
};

export const QUARANTINE: readonly QuarantineEntry[] = Object.entries(UNATTACHED).flatMap(
  ([id, layers]) =>
    layers.map((layer) => ({
      case: id,
      target: "astro",
      layer,
      reason: "scoped styles not attached yet",
      issue: "UXF-400",
    })),
);
