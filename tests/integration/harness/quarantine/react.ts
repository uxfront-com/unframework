// The React quarantine (ADR-0057): React's known failures, each with its reason and issue. Only
// entries whose target is "react" belong here, so each target lane edits its own file.
import type { QuarantineEntry } from "@unframework/testing/node";

/**
 * ADR-0058's open item, measured: react-dom keeps a controlled checkbox's and radio's `checked`
 * attribute and a controlled `<textarea>`'s text in step with their state, where Vue sets the
 * properties only. Until the normaliser leaves out a bound control's default state for them, as
 * it does an `<input>`'s `value`, the DOM and the trace differ. A `<textarea>` React fills from its
 * text also takes the caret at its start on focus, where Vue's set value leaves it at the end.
 */
const DEFAULT_STATE = "ADR-0058's open item: react-dom writes a bound control's default state";

export const QUARANTINE: readonly QuarantineEntry[] = [
  ...["models/checkbox-group", "models/radio"].flatMap((id) =>
    (["L7", "L9"] as const).map((layer) => ({
      case: id,
      target: "react",
      layer,
      reason: `${DEFAULT_STATE}: the \`checked\` attribute.`,
      issue: "UXF-315",
    })),
  ),
  ...(["L7", "L9", "L10"] as const).map((layer) => ({
    case: "models/textarea",
    target: "react",
    layer,
    reason: `${DEFAULT_STATE}: a <textarea>'s text, which also starts the caret at the text's start.`,
    issue: "UXF-315",
  })),
];
