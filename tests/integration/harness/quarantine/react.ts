// The React quarantine (ADR-0057): React's known failures, each with its reason and issue. Only
// entries whose target is "react" belong here, so each target lane edits its own file.
import type { LayerName, QuarantineEntry } from "@unframework/testing/node";

// M5 (UXF-443)
/**
 * The types and generics cells that fail until React's types lane (layer 16 of M5) emits
 * cross-file types and generic components (ADR-0067, ADR-0068): Vue wrote their expectations first
 * (layer 14), and the lane empties this list.
 */
const TYPES: Readonly<Record<string, readonly LayerName[]>> = {
  "diagnostics/generic-slot-props": ["L4"],
  "generics/constrained": ["L4"],
  "generics/list": ["L4"],
  "generics/scoped-slot": ["L4"],
  "generics/select": ["L4"],
  "types/child-type-import": ["L4"],
  "types/extends-chain": ["L4"],
  "types/imported-interface": ["L4"],
  "types/intersection-props": ["L4"],
  "types/package-types": ["L4"],
  "types/shared-type": ["L4"],
  "types/utility-types": ["L4"],
};

export const QUARANTINE: readonly QuarantineEntry[] = Object.entries(TYPES).flatMap(
  ([id, layers]) =>
    layers.map((layer) => ({
      case: id,
      target: "react",
      layer,
      reason: "imports no type and writes no generic form yet",
      issue: "UXF-462",
    })),
);
