// The CSS an entry's layout puts on the frame's mount container (ADR-0114), without a browser.
import { describe, expect, it } from "vitest";

import { layoutStyle } from "../src/preview/layout.ts";
import { DEFAULT_LAYOUT } from "../src/preview/protocol.ts";
import type { PreviewLayout } from "../src/preview/protocol.ts";

const FLEX = {
	display: "flex",
	"box-sizing": "border-box",
	"min-height": "100%",
	padding: "1rem",
	"flex-direction": "row",
	"justify-content": "safe center",
	"align-items": "safe center",
	"flex-wrap": "nowrap",
	gap: "0",
};

describe("layoutStyle", () => {
	it("centres an entry without a layout in a row, with padding and no gap", () => {
		expect(layoutStyle()).toEqual(FLEX);
		expect(layoutStyle(undefined)).toEqual(FLEX);
		expect(layoutStyle(DEFAULT_LAYOUT)).toEqual(FLEX);
	});

	it("makes none a block that fills the frame, with no padding", () => {
		expect(layoutStyle({ display: "block" })).toEqual({
			display: "block",
			"box-sizing": "border-box",
			"min-height": "100%",
			padding: "0",
		});
	});

	it.each<[Partial<Extract<PreviewLayout, { display: "flex" }>>, Record<string, string>]>([
		[{ direction: "column" }, { "flex-direction": "column" }],
		[{ justify: "start" }, { "justify-content": "flex-start" }],
		[{ justify: "center" }, { "justify-content": "safe center" }],
		[{ justify: "end" }, { "justify-content": "safe flex-end" }],
		[{ justify: "between" }, { "justify-content": "space-between" }],
		[{ justify: "around" }, { "justify-content": "space-around" }],
		[{ justify: "evenly" }, { "justify-content": "space-evenly" }],
		[{ align: "start" }, { "align-items": "flex-start" }],
		[{ align: "center" }, { "align-items": "safe center" }],
		[{ align: "end" }, { "align-items": "safe flex-end" }],
		[{ align: "stretch" }, { "align-items": "stretch" }],
		[{ align: "baseline" }, { "align-items": "baseline" }],
		[{ wrap: true }, { "flex-wrap": "wrap" }],
		[{ gap: "0.5rem" }, { gap: "0.5rem" }],
	])("maps %j to its declarations", (sets, declarations) => {
		expect(layoutStyle({ ...DEFAULT_LAYOUT, ...sets })).toEqual({ ...FLEX, ...declarations });
	});
});
