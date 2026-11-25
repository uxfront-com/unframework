// transitions/swap: a ternary swap and an else-if chain, each in a `<Transition>` and each of one
// tag (ADR-0100). When the shown branch changes, the old element leaves while the new one enters,
// so both are in the DOM, the old one with `-leave-active` and the new one with `-enter-active`,
// until the leave ends, and then only the new one stays. Their order in the DOM during the swap is
// the target's, so each frame's reading sorts them. The harness gives no transition a duration
// (plan §7.6), so the tests that swap give the case's `-active` classes one for themselves, and
// read the classes once a frame.
//
// Each element ends on its own `transitionend`, or on its own timer (ADR-0100, "The end"), as
// Vue's `whenTransitionEnds` does. So the leave and the enter start in the same frame, but can end
// a frame apart, and a frame can then read one element settled while the other still runs. The
// tests check each element's own order of classes, and that the two start together, never that
// they end together.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Steps from "./Steps.uf.tsx";

/**
 * Reads, once a frame until `stop`, the transition's classes of each element `selector` matches
 * in `root`, as `text: classes`, and returns each reading that differs from the one before.
 */
function everyFrame(
	root: Element,
	selector: string,
	prefix: string,
): { stop: () => Array<string> } {
	const frames: Array<string> = [];
	let running = true;
	const read = () => {
		if (!running) {
			return;
		}
		const elements = [...root.querySelectorAll(selector)];
		frames.push(
			elements
				.map((element) => {
					const classes = [...element.classList].filter((name) => name.startsWith(`${prefix}-`));
					return `${element.textContent}: ${classes.toSorted().join(" ")}`.trimEnd();
				})
				.toSorted()
				.join(" | "),
		);
		requestAnimationFrame(read);
	};
	requestAnimationFrame(read);
	return {
		stop: () => {
			running = false;
			return frames.filter((frame, index) => frame !== frames[index - 1]);
		},
	};
}

/**
 * Splits `everyFrame`'s readings into each element's own sequence of classes, by its text, with
 * consecutive duplicates removed. An element read twice in one frame, or missing from a reading
 * between two that hold it, fails the test: a swap keeps both elements in the DOM until the
 * leave ends (ADR-0100).
 */
function byElement(frames: Array<string>): Record<string, Array<string>> {
	const sequences: Record<string, Array<string>> = {};
	const lastRead = new Map<string, number>();
	frames.forEach((frame, index) => {
		for (const entry of frame.split(" | ")) {
			if (entry === "") {
				continue;
			}
			// A settled reading has been through `trimEnd`, so it is `text:`, with no space to split on.
			const colon = entry.lastIndexOf(":");
			if (colon === -1) {
				throw new Error(`The reading "${entry}" has no ":".`);
			}
			const text = entry.slice(0, colon);
			const classes = entry.slice(colon + 1).trim();
			const last = lastRead.get(text);
			if (last === index) {
				throw new Error(`Two elements read "${text}" in one frame: "${frame}".`);
			}
			if (last !== undefined && last !== index - 1) {
				throw new Error(`"${text}" left the DOM and came back: ${JSON.stringify(frames)}`);
			}
			lastRead.set(text, index);
			const sequence = (sequences[text] ??= []);
			if (sequence.at(-1) !== classes) {
				sequence.push(classes);
			}
		}
	});
	return sequences;
}

/**
 * Asserts that a swap starts in step: the reading `settled` before it, then the `-from` pair,
 * then the `-to` pair, in three readings in a row. The leave and the enter take each class in the
 * same frame. Their ends come after the `-to` pair, so a frame between the two ends can't reach
 * this check.
 */
function expectStartInStep(
	readings: Array<string>,
	settled: string,
	from: string,
	to: string,
): void {
	const index = readings.indexOf(from);
	expect(readings, "the -from pair is one reading").toContain(from);
	expect(readings.slice(index - 1, index + 2)).toEqual([settled, from, to]);
}

/** Gives the `-active` classes of `name` a duration of their own, until the returned removal. */
function slowDown(name: string): () => void {
	const style = document.createElement("style");
	// A class beats the harness's `*` among `!important` declarations.
	style.textContent = `.${name}-enter-active, .${name}-leave-active { transition: all 200ms linear !important; }`;
	document.head.append(style);
	return () => style.remove();
}
describeTargets("transitions/swap", () => {
	it("renders the first branch of each", async () => {
		const view = await mountScenario(Steps, "default");
		await view.expectParity("default");
		await expect.element(view.getByText("Cart")).toBeVisible();
		await expect.element(view.getByText("Step one")).toBeVisible();
	});

	it(
		"runs the old branch's leave and the new one's enter at once",
		{ requires: ["transition", "interactivity"] },
		async () => {
			const restore = slowDown("swap");
			try {
				const view = await mountScenario(Steps, "default");
				const frames = everyFrame(view.container, ".card", "swap");
				await view.user.click(view.getByRole("button", { name: "Swap" }));
				await view.expectParity("swapped");
				const readings = frames.stop();
				expect(byElement(readings)).toEqual({
					Cart: ["", "swap-leave-active swap-leave-from", "swap-leave-active swap-leave-to"],
					Payment: ["swap-enter-active swap-enter-from", "swap-enter-active swap-enter-to", ""],
				});
				// At once: the leave and the enter take each class in the same frame.
				expectStartInStep(
					readings,
					"Cart:",
					"Cart: swap-leave-active swap-leave-from | Payment: swap-enter-active swap-enter-from",
					"Cart: swap-leave-active swap-leave-to | Payment: swap-enter-active swap-enter-to",
				);
				await expect.element(view.getByText("Payment")).toBeVisible();
				expect(view.container.querySelectorAll(".card")).toHaveLength(1);
			} finally {
				restore();
			}
		},
	);

	it(
		"runs each step of an else-if chain in turn",
		{ requires: ["transition", "interactivity"] },
		async () => {
			const restore = slowDown("step");
			try {
				const view = await mountScenario(Steps, "default");
				const frames = everyFrame(view.container, ".step", "step");
				await view.user.click(view.getByRole("button", { name: "Next" }));
				await view.expectParity("second-step");
				await view.user.click(view.getByRole("button", { name: "Next" }));
				await view.expectParity("third-step");
				const readings = frames.stop();
				expect(byElement(readings)).toEqual({
					"Step one": ["", "step-leave-active step-leave-from", "step-leave-active step-leave-to"],
					"Step two": [
						"step-enter-active step-enter-from",
						"step-enter-active step-enter-to",
						"",
						"step-leave-active step-leave-from",
						"step-leave-active step-leave-to",
					],
					"Step three": [
						"step-enter-active step-enter-from",
						"step-enter-active step-enter-to",
						"",
					],
				});
				// In turn, each swap's leave and enter take each class in the same frame.
				expectStartInStep(
					readings,
					"Step one:",
					"Step one: step-leave-active step-leave-from | Step two: step-enter-active step-enter-from",
					"Step one: step-leave-active step-leave-to | Step two: step-enter-active step-enter-to",
				);
				expectStartInStep(
					readings,
					"Step two:",
					"Step three: step-enter-active step-enter-from | Step two: step-leave-active step-leave-from",
					"Step three: step-enter-active step-enter-to | Step two: step-leave-active step-leave-to",
				);
				await expect.element(view.getByText("Step three")).toBeVisible();
			} finally {
				restore();
			}
		},
	);
});
