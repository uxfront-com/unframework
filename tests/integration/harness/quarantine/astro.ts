// The Astro quarantine (ADR-0057): Astro's known failures, each with its reason and issue. Only
// entries whose target is "astro" belong here, so each target lane edits its own file.
import type { QuarantineEntry } from "@unframework/testing/node";

/**
 * Context is unsupported on Astro (ADR-0054, a warning): `inject` gives its fallback, so the
 * render differs from Vue's by declaration. The specs do not require `context`, and L6 has no
 * skip by capability, so the cells fail until they can.
 */
const CONTEXT: readonly QuarantineEntry[] = [
  "context/fallback",
  "context/nested",
  "context/reactive",
  "context/static",
].flatMap((id) =>
  (["L6", "L7", "L8", "L10"] as const).map((layer) => ({
    case: id,
    target: "astro",
    layer,
    reason:
      "Astro's `context` cell is unsupported, so `inject` gives its fallback; the case has no skip by capability for it.",
    issue: "UXF-320",
  })),
);

/**
 * A static control shows its model's state as markup (`checked`, `selected`, a `<textarea>`'s
 * text), where Vue's client sets the property alone: the normaliser drops only an `<input>`'s
 * settled `value` (ADR-0058, rule 4d).
 */
const CONTROLS: readonly QuarantineEntry[] = [
  ["models/checkbox-group", "L7"],
  ["models/radio", "L7"],
  ["models/select", "L7"],
  ["models/select-multiple", "L7"],
  ["models/textarea", "L7"],
  ["models/textarea", "L10"],
].map(([id, layer]) => ({
  case: id!,
  target: "astro",
  layer: layer as QuarantineEntry["layer"],
  reason:
    "Astro writes a control's state as markup, which the normaliser compares with Vue's properties.",
  issue: "UXF-320",
}));

export const QUARANTINE: readonly QuarantineEntry[] = [...CONTEXT, ...CONTROLS];
