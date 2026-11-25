// The guard every solid2 project's setup runs (ADR-0102): a solid2 layer that loads Solid 1 would
// pass by accident where both majors render alike, so it fails at once instead.
import * as solid from "solid-js";

/** Throws unless `solid-js` is Solid 2, which has `flush` and `onSettled` and Solid 1 doesn't. */
export function assertSolid2(): void {
	const exports = solid as Record<string, unknown>;
	if (typeof exports["flush"] !== "function" || typeof exports["onSettled"] !== "function") {
		throw new Error(
			"The solid2 project loaded Solid 1: solid-js must resolve from the toolchain directory, which holds Solid 2 (ADR-0102).",
		);
	}
}
