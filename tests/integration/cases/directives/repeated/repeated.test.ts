// directives/repeated: one directive use whose element a child renders any number of times
// (ADR-0099). Each element gets its own hooks, counted element by element: a row of another
// file's list that a wrapper forwards the slot to, either branch of a ternary, and an item of a
// scoped slot whose fill reads only the page's state. A template ref beside one is filled too.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import type { View } from "@unframework.dev/testing";
import { expect } from "vitest";

import Page from "./Page.uf.tsx";

interface Trace {
	call: string;
	el: Element;
}

/**
 * Records the hooks' calls the directive reports on the document. `since` gives, from a mark, the
 * calls of each element `view` mounted, by element in the order of their first call: an element
 * is the view's once it was mounted in its container, wherever it is afterwards. A run may mount
 * other views beside the test's (L12 renders the client side too).
 */
function record(): {
	mark: () => number;
	since: (view: View, mark: number) => { name: string | null; calls: string[] }[];
	stop: () => void;
} {
	const traces: Trace[] = [];
	const own = new Set<Element>();
	const listener = (event: Event) => void traces.push((event as CustomEvent<Trace>).detail);
	document.addEventListener("directive-trace", listener);
	return {
		mark: () => traces.length,
		since: (view, mark) => {
			for (const { call, el } of traces) {
				if (call.startsWith("mounted") && view.container.contains(el)) own.add(el);
			}
			const found = new Map<Element, string[]>();
			for (const { call, el } of traces.slice(mark)) {
				if (!own.has(el)) continue;
				found.set(el, [...(found.get(el) ?? []), call]);
			}
			return [...found].map(([el, calls]) => ({ name: el.getAttribute("data-name"), calls }));
		},
		stop: () => document.removeEventListener("directive-trace", listener),
	};
}

/** The elements' names and calls, sorted, so a count doesn't depend on which target runs first. */
function sorted(found: { name: string | null; calls: string[] }[]): string[] {
	return found.map(({ name, calls }) => `${name}: ${calls.join(", ")}`).toSorted();
}

describeTargets("directives/repeated", () => {
	it("renders every row, the body and every item", async () => {
		const view = await mountScenario(Page, "initial");
		await view.expectParity("initial");
		await expect.element(view.getByRole("button", { name: "Rename" })).toBeVisible();
	});

	it("runs each hook on each element apart", { requires: ["directive"] }, async () => {
		const trace = record();
		try {
			let mark = trace.mark();
			const view = await mountScenario(Page, "initial");
			await view.expectParity("traced");
			expect(sorted(trace.since(view, mark))).toEqual([
				"body: mounted first",
				"item: mounted first",
				"item: mounted first",
				"note: mounted first",
				"row: mounted first",
				"row: mounted first",
			]);
			// The template ref beside the directive holds its element.
			await view.user.click(view.getByRole("button", { name: "Check" }));
			await view.expectParity("checked");
			await expect.poll(() => view.container.querySelector("output")?.textContent).toBe("note");

			mark = trace.mark();
			await view.user.click(view.getByRole("button", { name: "Add row" }));
			await view.expectParity("added");
			expect(trace.since(view, mark)).toEqual([{ name: "row", calls: ["mounted first"] }]);

			mark = trace.mark();
			await view.user.click(view.getByRole("button", { name: "Remove row" }));
			await view.expectParity("removed");
			expect(trace.since(view, mark)).toEqual([{ name: "row", calls: ["unmounted"] }]);

			mark = trace.mark();
			await view.user.click(view.getByRole("button", { name: "Rename" }));
			await view.expectParity("renamed");
			expect(sorted(trace.since(view, mark))).toEqual([
				"body: updated second first",
				"item: updated second first",
				"item: updated second first",
				"note: updated second first",
				"row: updated second first",
				"row: updated second first",
			]);

			mark = trace.mark();
			await view.user.click(view.getByRole("button", { name: "Switch" }));
			await view.expectParity("switched");
			// The old branch's element leaves before the new one's mounts.
			expect(trace.since(view, mark)).toEqual([
				{ name: "body", calls: ["unmounted"] },
				{ name: "body", calls: ["mounted second"] },
			]);

			mark = trace.mark();
			await view.unmount();
			expect(sorted(trace.since(view, mark))).toEqual([
				"body: unmounted",
				"item: unmounted",
				"item: unmounted",
				"note: unmounted",
				"row: unmounted",
				"row: unmounted",
			]);
		} finally {
			trace.stop();
		}
	});
});
