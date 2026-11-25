// The Solid quarantine (ADR-0057): Solid's known failures, each with its reason and issue. Only
// entries whose target is "solid" belong here, so each target lane edits its own file.
import type { QuarantineEntry } from "@unframework.dev/testing/node";

export const QUARANTINE: readonly QuarantineEntry[] = [
	{
		case: "directives/fill-props",
		target: "solid",
		layer: "L8",
		reason:
			"Solid calls a scoped slot inside the row's JSX, so a new props object for one row runs the fill again and replaces its element: the element is a new one, and its directive runs `unmounted` and `mounted` where every other target keeps the element and runs `updated`.",
		issue: "UXF-827",
	},
	{
		case: "directives/fill-props",
		target: "solid",
		layer: "L12",
		reason:
			"As L8: Solid calls a scoped slot inside the row's JSX, so a new props object for one row runs the fill again and replaces its element: the element is a new one, and its directive runs `unmounted` and `mounted` where every other target keeps the element and runs `updated`.",
		issue: "UXF-827",
	},
];
