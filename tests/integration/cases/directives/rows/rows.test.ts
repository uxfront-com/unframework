// directives/rows: a directive on each row a list renders, and on each element a scoped fill
// renders, whose value reads the row's item or the fill's props (ADR-0108). Each element gets its
// own hooks with its own value, counted element by element and directive by directive: a row that
// applies two directives, one that listens beside its directive, and one whose value reads the
// component's state too.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import type { View } from "@unframework.dev/testing";
import { expect } from "vitest";

import Menu from "./Menu.uf.tsx";

interface Trace {
	call: string;
	el: Element;
}

/**
 * Records the hooks' calls the directives report on the document. `since` gives, from a mark, the
 * calls of each element `view` mounted, by element in the order of their first call: an element
 * is the view's once it was mounted in its container, wherever it is afterwards. A run may mount
 * other views beside the test's (L12 renders the client side too).
 */
function record(): {
	mark: () => number;
	since: (view: View, mark: number) => Array<{ name: string | null; calls: Array<string> }>;
	stop: () => void;
} {
	const traces: Array<Trace> = [];
	const own = new Set<Element>();
	const listener = (event: Event) => void traces.push((event as CustomEvent<Trace>).detail);
	document.addEventListener("directive-trace", listener);
	return {
		mark: () => traces.length,
		since: (view, mark) => {
			for (const { call, el } of traces) {
				if (call.includes(" mounted ") && view.container.contains(el)) {
					own.add(el);
				}
			}
			const found = new Map<Element, Array<string>>();
			for (const { call, el } of traces.slice(mark)) {
				if (!own.has(el)) {
					continue;
				}
				found.set(el, [...(found.get(el) ?? []), call]);
			}
			return [...found].map(([el, calls]) => ({ name: el.getAttribute("data-name"), calls }));
		},
		stop: () => document.removeEventListener("directive-trace", listener),
	};
}

/**
 * Each element's calls of each directive, by the element's and the directive's names, sorted, so
 * a count depends neither on which target runs first nor on the order two directives of one
 * element run in, which Vue's attribute order gives and Solid and Angular don't keep.
 */
function sorted(found: Array<{ name: string | null; calls: Array<string> }>): Array<string> {
	return found
		.flatMap(({ name, calls }) => {
			const byDirective = new Map<string, Array<string>>();
			for (const call of calls) {
				const [directive = "", ...rest] = call.split(" ");
				byDirective.set(directive, [...(byDirective.get(directive) ?? []), rest.join(" ")]);
			}
			return [...byDirective].map(([directive, own]) => `${name} ${directive}: ${own.join(", ")}`);
		})
		.toSorted();
}

/** The view's elements that carry a directive, by their names. */
function elements(view: View, names: Array<string>): Array<Element | null> {
	return names.map((name) => view.container.querySelector(`[data-name="${name}"]`));
}

/** The name of the child's first option. */
function firstOption(view: View): string | null | undefined {
	return view.container.querySelector('[data-name^="option-"]')?.getAttribute("data-name");
}

describeTargets("directives/rows", () => {
	it("renders every row and every option", async () => {
		const view = await mountScenario(Menu, "initial");
		await view.expectParity("initial");
		await expect.element(view.getByRole("button", { name: "Rename first" })).toBeVisible();
	});

	it(
		"runs each hook on each element apart, with its own value",
		{ requires: ["directive"] },
		async () => {
			const trace = record();
			try {
				let mark = trace.mark();
				const view = await mountScenario(Menu, "initial");
				await view.expectParity("traced");
				expect(sorted(trace.since(view, mark))).toEqual([
					"a trace: mounted Alpha",
					"b trace: mounted Beta",
					"both-a mark: mounted a",
					"both-a trace: mounted Alpha",
					"both-b mark: mounted b",
					"both-b trace: mounted Beta",
					"both-c mark: mounted c",
					"both-c trace: mounted Gamma",
					"c trace: mounted Gamma",
					"focus-a trace: mounted Alpha",
					"focus-b trace: mounted Beta",
					"focus-c trace: mounted Gamma",
					"note-a trace: mounted First",
					"option-x trace: mounted Open Xray",
					"option-y trace: mounted Open Yankee",
					"prefixed-a trace: mounted Open Alpha",
					"prefixed-b trace: mounted Open Beta",
					"prefixed-c trace: mounted Open Gamma",
				]);
				// The listener beside a directive runs once per event.
				const output = () => view.container.querySelector("output")?.textContent;
				await view.user.click(view.getByRole("button", { name: "Focus Alpha" }));
				await view.expectParity("focused");
				await expect.poll(output).toBe("1");

				// Renaming one row runs `updated` on that row's elements only, and no other directive.
				mark = trace.mark();
				await view.user.click(view.getByRole("button", { name: "Rename first" }));
				await view.expectParity("renamed");
				expect(sorted(trace.since(view, mark))).toEqual([
					"a trace: updated Alpha 2 Alpha",
					"both-a trace: updated Alpha 2 Alpha",
					"focus-a trace: updated Alpha 2 Alpha",
					"prefixed-a trace: updated Open Alpha 2 Open Alpha",
				]);
				// A render of the list adds the listener no second time.
				await view.user.click(view.getByRole("button", { name: "Focus Beta" }));
				await view.expectParity("focused-again");
				await expect.poll(output).toBe("2");

				// A keyed reverse keeps every row's element, and runs no hook.
				const names = ["a", "b", "c", "both-a", "focus-b", "prefixed-c"];
				const before = elements(view, names);
				mark = trace.mark();
				await view.user.click(view.getByRole("button", { name: "Reverse" }));
				await view.expectParity("reversed");
				expect(trace.since(view, mark)).toEqual([]);
				const after = elements(view, names);
				for (const [index, element] of before.entries()) {
					expect(after[index]).toBe(element);
				}

				mark = trace.mark();
				await view.user.click(view.getByRole("button", { name: "Remove second" }));
				await view.expectParity("removed");
				expect(sorted(trace.since(view, mark))).toEqual([
					"b trace: unmounted",
					"both-b mark: unmounted",
					"both-b trace: unmounted",
					"focus-b trace: unmounted",
					"prefixed-b trace: unmounted",
				]);

				mark = trace.mark();
				await view.user.click(view.getByRole("button", { name: "Add item" }));
				await view.expectParity("added");
				expect(sorted(trace.since(view, mark))).toEqual([
					"both-d mark: mounted d",
					"both-d trace: mounted Delta",
					"d trace: mounted Delta",
					"focus-d trace: mounted Delta",
					"prefixed-d trace: mounted Open Delta",
				]);

				// State that every row's and fill's value reads runs `updated` on each of their elements once,
				// the fill's too, while the child doesn't render.
				mark = trace.mark();
				await view.user.click(view.getByRole("button", { name: "Change prefix" }));
				await view.expectParity("prefixed");
				expect(sorted(trace.since(view, mark))).toEqual([
					"option-x trace: updated Close Xray Open Xray",
					"option-y trace: updated Close Yankee Open Yankee",
					"prefixed-a trace: updated Close Alpha 2 Open Alpha 2",
					"prefixed-c trace: updated Close Gamma Open Gamma",
					"prefixed-d trace: updated Close Delta Open Delta",
				]);

				// The child reverses and removes its options while the parent doesn't render.
				const options = elements(view, ["option-x", "option-y"]);
				mark = trace.mark();
				await view.user.click(view.getByRole("button", { name: "Reverse options" }));
				await view.expectParity("options-reversed");
				expect(firstOption(view)).toBe("option-y");
				expect(trace.since(view, mark)).toEqual([]);
				const reversed = elements(view, ["option-x", "option-y"]);
				for (const [index, element] of options.entries()) {
					expect(reversed[index]).toBe(element);
				}
				mark = trace.mark();
				await view.user.click(view.getByRole("button", { name: "Remove option" }));
				await view.expectParity("options-removed");
				expect(trace.since(view, mark)).toEqual([{ name: "option-y", calls: ["trace unmounted"] }]);

				mark = trace.mark();
				await view.unmount();
				expect(sorted(trace.since(view, mark))).toEqual([
					"a trace: unmounted",
					"both-a mark: unmounted",
					"both-a trace: unmounted",
					"both-c mark: unmounted",
					"both-c trace: unmounted",
					"both-d mark: unmounted",
					"both-d trace: unmounted",
					"c trace: unmounted",
					"d trace: unmounted",
					"focus-a trace: unmounted",
					"focus-c trace: unmounted",
					"focus-d trace: unmounted",
					"note-a trace: unmounted",
					"option-x trace: unmounted",
					"prefixed-a trace: unmounted",
					"prefixed-c trace: unmounted",
					"prefixed-d trace: unmounted",
				]);
			} finally {
				trace.stop();
			}
		},
	);
});
