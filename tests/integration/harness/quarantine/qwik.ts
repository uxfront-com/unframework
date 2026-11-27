// The Qwik quarantine (ADR-0057): Qwik's known failures, each with its reason and issue. Only
// entries whose target is "qwik" belong here, so each target lane edits its own file.
import type { QuarantineEntry } from "@unframework.dev/testing/node";

export const QUARANTINE: ReadonlyArray<QuarantineEntry> = [
	{
		case: "slots/repeated-default",
		target: "qwik",
		layer: "L6",
		reason:
			"Qwik's `<Slot />` projects the default slot once (`11.slots.md`), so a default slot the component renders more than once at a time shows the fill once or not at all: in the rows of `RowList` and `TagList`, in `FramedNote`'s header and footer, in both of `FadeFace`'s branches while one leaves, and in `EachAction`'s fill that `EachSlot` renders per row. Inside a fill a child renders, as `OnceAction`'s, the `<Slot />` runs in the child, which shows the fallback.",
		issue: "UXF-1174",
	},
	{
		case: "slots/repeated-default",
		target: "qwik",
		layer: "L7",
		reason:
			"Qwik's `<Slot />` projects the default slot once (`11.slots.md`), so a default slot the component renders more than once at a time shows the fill once or not at all: in the rows of `RowList` and `TagList`, in `FramedNote`'s header and footer, in both of `FadeFace`'s branches while one leaves, and in `EachAction`'s fill that `EachSlot` renders per row. Inside a fill a child renders, as `OnceAction`'s, the `<Slot />` runs in the child, which shows the fallback.",
		issue: "UXF-1174",
	},
	{
		case: "slots/repeated-default",
		target: "qwik",
		layer: "L8",
		reason:
			"Qwik's `<Slot />` projects the default slot once (`11.slots.md`), so a default slot the component renders more than once at a time shows the fill once or not at all: in the rows of `RowList` and `TagList`, in `FramedNote`'s header and footer, in both of `FadeFace`'s branches while one leaves, and in `EachAction`'s fill that `EachSlot` renders per row. Inside a fill a child renders, as `OnceAction`'s, the `<Slot />` runs in the child, which shows the fallback.",
		issue: "UXF-1174",
	},
	{
		case: "slots/repeated-default",
		target: "qwik",
		layer: "L9",
		reason:
			"Qwik's `<Slot />` projects the default slot once (`11.slots.md`), so a default slot the component renders more than once at a time shows the fill once or not at all: in the rows of `RowList` and `TagList`, in `FramedNote`'s header and footer, in both of `FadeFace`'s branches while one leaves, and in `EachAction`'s fill that `EachSlot` renders per row. Inside a fill a child renders, as `OnceAction`'s, the `<Slot />` runs in the child, which shows the fallback.",
		issue: "UXF-1174",
	},
	{
		case: "slots/repeated-default",
		target: "qwik",
		layer: "L10",
		reason:
			"Qwik's `<Slot />` projects the default slot once (`11.slots.md`), so a default slot the component renders more than once at a time shows the fill once or not at all: in the rows of `RowList` and `TagList`, in `FramedNote`'s header and footer, in both of `FadeFace`'s branches while one leaves, and in `EachAction`'s fill that `EachSlot` renders per row. Inside a fill a child renders, as `OnceAction`'s, the `<Slot />` runs in the child, which shows the fallback.",
		issue: "UXF-1174",
	},
];
