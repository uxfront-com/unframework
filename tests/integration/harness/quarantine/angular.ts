// The Angular quarantine (ADR-0057): Angular's known failures, each with its reason and issue. Only
// entries whose target is "angular" belong here, so each target lane edits its own file.
import { BROWSER_LAYERS } from "@unframework/testing/node";
import type { LayerName, QuarantineEntry } from "@unframework/testing/node";

// M5 (UXF-443)
/**
 * The browser layers of a case whose L3 entry stands: its spec runs against a stand-in, which
 * fails each of them with that cause (`harness/no-output.ts`, ADR-0068).
 */
const STAND_IN: readonly LayerName[] = BROWSER_LAYERS;

/**
 * The types and generics cells that fail until Angular's types lane (layer 23 of M5) emits
 * cross-file types and generic components (ADR-0067, ADR-0068): Vue wrote their expectations first
 * (layer 14), and the lane empties this list.
 */
const TYPES: Readonly<Record<string, readonly LayerName[]>> = {
  "diagnostics/generic-slot-props": ["L3", "L4", "L6"],
  "generics/constrained": ["L3", "L4", "L6", ...STAND_IN],
  "generics/list": ["L3", "L4", "L6", ...STAND_IN],
  "generics/scoped-slot": ["L3", "L4", "L6", ...STAND_IN],
  "generics/select": ["L3", "L4", "L6", ...STAND_IN],
  "types/child-type-import": ["L3", "L4", "L6", ...STAND_IN],
  "types/package-types": ["L3", "L4", "L6", ...STAND_IN],
  "types/shared-type": ["L3", "L4", "L6", ...STAND_IN],
  "types/utility-types": ["L3", "L4", "L6", ...STAND_IN],
};

export const QUARANTINE: readonly QuarantineEntry[] = Object.entries(TYPES).flatMap(
  ([id, layers]) =>
    layers.map((layer) => ({
      case: id,
      target: "angular",
      layer,
      reason: "imports no type and declares no type parameter yet",
      issue: "UXF-465",
    })),
);
