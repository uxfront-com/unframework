// transitions/leave: `<Transition name="fade">` around a menu that is open at first (ADR-0100).
// Once its condition turns false, the menu stays in its place, carrying `fade-leave-active`, until
// its leave ends, and only then is it removed. The harness gives no transition a duration (plan
// §7.6), so the second test gives the case's `-active` classes one for itself, and reads the
// classes once a frame: every capture still sees the settled DOM.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Menu from "./Menu.uf.tsx";

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
describeTargets("transitions/leave", () => {
	it("renders the open menu", async () => {
		const view = await mountScenario(Menu, "open");
		await view.expectParity("open");
		await expect.element(view.getByText("Sign out")).toBeVisible();
	});

	it(
		"keeps the menu in its place with fade-leave-active until its leave ends",
		{ requires: ["transition", "interactivity"] },
		async () => {
			const restore = slowDown("fade");
			try {
				const view = await mountScenario(Menu, "open");
				const menu = view.container.querySelector(".items")!;
				const frames = everyFrame(view.container, ".items", "fade");
				await view.user.click(view.getByRole("button", { name: "Account" }));
				await view.expectParity("closed");
				// While it leaves, the menu is still connected, in its place, carrying fade-leave-active.
				expect(frames.stop()).toEqual([
					"ProfileSign out:",
					"ProfileSign out: fade-leave-active fade-leave-from",
					"ProfileSign out: fade-leave-active fade-leave-to",
					"",
				]);
				// Once the leave has ended, it is gone.
				expect(menu.isConnected).toBe(false);
				expect(view.container.querySelector(".items")).toBeNull();
				await expect
					.element(view.getByRole("button", { name: "Account" }))
					.toHaveAttribute("aria-expanded", "false");
			} finally {
				restore();
			}
		},
	);
});
