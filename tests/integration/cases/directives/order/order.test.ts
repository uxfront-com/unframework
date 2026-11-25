// directives/order: the order a directive's hooks run in on nested and sibling elements
// (ADR-0099). Within one render, `mounted` runs on an element after its descendants and after
// its earlier siblings, as Vue's own order is (a post-order of the DOM). `unmounted` runs on an
// element after its descendants, whether a condition removes them or the component unmounts. A
// child component's root, which applies a `.uf.ts` module's directive, sorts among its parent's
// elements in document order. When a condition swaps one branch for another, the removed
// branch's `unmounted` runs before the added one's `mounted`, as on Vue.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import type { View } from "@unframework.dev/testing";
import { expect } from "vitest";

import Tree from "./Tree.uf.tsx";

interface Trace {
	call: string;
	el: Element;
}

/**
 * Records the hooks' calls the directive reports on the document, in order. A run may mount other
 * views beside the test's (L12 renders the client side too), so `calls` keeps those of the
 * elements `view` mounted: in its container when mounted, and wherever they are once removed.
 * `reset` forgets the calls so far, never which elements are the view's.
 */
function record(): { calls: (view: View) => string[]; reset: () => void; stop: () => void } {
	let traces: Trace[] = [];
	const own = new Set<Element>();
	const listener = (event: Event) => {
		const trace = (event as CustomEvent<Trace>).detail;
		traces.push(trace);
	};
	document.addEventListener("directive-trace", listener);
	return {
		calls: (view) =>
			traces.flatMap(({ call, el }) => {
				if (call.startsWith("mounted") && view.container.contains(el)) own.add(el);
				return own.has(el) ? [call] : [];
			}),
		reset: () => {
			traces = [];
		},
		stop: () => document.removeEventListener("directive-trace", listener),
	};
}

describeTargets("directives/order", () => {
	it("renders the tree", async () => {
		const view = await mountScenario(Tree, "initial");
		await view.expectParity("initial");
		await expect.element(view.getByText("Leaf")).toBeVisible();
	});

	it(
		"runs mounted on descendants first, and on siblings in document order",
		{ requires: ["directive"] },
		async () => {
			const trace = record();
			try {
				const view = await mountScenario(Tree, "initial");
				await view.expectParity("traced");
				expect(trace.calls(view)).toEqual([
					"mounted first",
					"mounted note",
					"mounted leaf",
					"mounted branch",
					"mounted last",
					"mounted outer",
				]);
			} finally {
				trace.stop();
			}
		},
	);

	it(
		"runs unmounted on a removed element's descendants first",
		{ requires: ["directive"] },
		async () => {
			const trace = record();
			try {
				const view = await mountScenario(Tree, "initial");
				await view.expectParity("mounted");
				expect(trace.calls(view)).toHaveLength(6);
				trace.reset();
				await view.user.click(view.getByRole("button", { name: "Toggle" }));
				await view.expectParity("collapsed");
				expect(trace.calls(view)).toEqual([
					"unmounted leaf",
					"unmounted branch",
					"mounted placeholder",
				]);
				trace.reset();
				await view.user.click(view.getByRole("button", { name: "Toggle" }));
				await view.expectParity("expanded");
				expect(trace.calls(view)).toEqual([
					"unmounted placeholder",
					"mounted leaf",
					"mounted branch",
				]);
				trace.reset();
				await view.unmount();
				const removal = trace.calls(view);
				expect(removal.toSorted()).toEqual([
					"unmounted branch",
					"unmounted first",
					"unmounted last",
					"unmounted leaf",
					"unmounted note",
					"unmounted outer",
				]);
				expect(removal.indexOf("unmounted leaf")).toBeLessThan(removal.indexOf("unmounted branch"));
				expect(removal.at(-1)).toBe("unmounted outer");
			} finally {
				trace.stop();
			}
		},
	);
});
