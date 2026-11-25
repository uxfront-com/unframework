// transitions/appear: `<Transition name="pop" appear>` around a toast (ADR-0100). The server
// renders it settled, with no class of the transition and no wrapper. When the toast mounts on the
// client, its enter runs: here as the inbox shows it again. Whether the enter runs after
// hydration is the target's, so no test reads the first mount's classes: they settle either way.
// The harness gives no transition a duration (plan §7.6), so the second test gives the case's
// `-active` classes one for itself, and reads the classes once a frame.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Inbox from "./Inbox.uf.tsx";

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

/** Gives the `-active` classes of `name` a duration of their own, until the returned removal. */
function slowDown(name: string): () => void {
	const style = document.createElement("style");
	// A class beats the harness's `*` among `!important` declarations.
	style.textContent = `.${name}-enter-active, .${name}-leave-active { transition: all 200ms linear !important; }`;
	document.head.append(style);
	return () => style.remove();
}
describeTargets("transitions/appear", () => {
	it("renders the toast settled", async () => {
		const view = await mountScenario(Inbox, "default");
		await view.expectParity("default");
		await expect.element(view.getByRole("status")).toHaveTextContent("Saved");
	});

	it(
		"runs the enter as the toast mounts",
		{ requires: ["transition", "interactivity"] },
		async () => {
			const restore = slowDown("pop");
			try {
				const view = await mountScenario(Inbox, "default");
				await view.user.click(view.getByRole("button", { name: "Hide" }));
				await view.expectParity("hidden");
				await expect.element(view.getByRole("button", { name: "Show" })).toBeVisible();
				const frames = everyFrame(view.container, ".toast", "pop");
				await view.user.click(view.getByRole("button", { name: "Show" }));
				await view.expectParity("shown");
				expect(frames.stop()).toEqual([
					"",
					"Saved: pop-enter-active pop-enter-from",
					"Saved: pop-enter-active pop-enter-to",
					"Saved:",
				]);
				await expect.element(view.getByRole("status")).toHaveTextContent("Saved");
			} finally {
				restore();
			}
		},
	);
});
