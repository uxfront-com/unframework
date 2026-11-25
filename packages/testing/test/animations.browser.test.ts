// A settle waits for the page's running animations (ADR-0100, extending plan §7.6's settling):
// a transition a spec gives a duration of its own ends before a capture, and one that never ends
// fails the settle within its bound.
import { afterEach, expect, it } from "vitest";

import { ANIMATION_WAIT_MS, settleFrame } from "../src/browser/determinism.ts";

afterEach(() => {
	for (const element of document.querySelectorAll("[data-animated]")) element.remove();
});

/** An element in `body` with an inline transition of `opacity` over `duration` ms. */
function transitioned(duration: number): HTMLElement {
	const element = document.createElement("p");
	element.dataset.animated = "";
	element.textContent = "Fading";
	// An inline `!important` beats the reset's, as a spec's class does.
	element.style.setProperty("transition", `opacity ${duration}ms linear`, "important");
	document.body.append(element);
	return element;
}

it("returns only once a running transition has ended", async () => {
	const element = transitioned(300);
	let ended = false;
	element.addEventListener("transitionend", () => {
		ended = true;
	});
	await settleFrame();
	element.style.opacity = "0";
	// The transition starts once its style is computed.
	expect(getComputedStyle(element).opacity).toBe("1");
	expect(document.getAnimations()).toHaveLength(1);
	const started = performance.now();
	await settleFrame();
	expect(performance.now() - started).toBeGreaterThanOrEqual(250);
	expect(ended).toBe(true);
	expect(document.getAnimations()).toEqual([]);
});

it("waits for nothing where the reset leaves no duration", async () => {
	const element = document.createElement("p");
	element.dataset.animated = "";
	element.style.transition = "opacity 300ms linear";
	document.body.append(element);
	await settleFrame();
	element.style.opacity = "0";
	expect(getComputedStyle(element).opacity).toBe("0");
	expect(document.getAnimations()).toEqual([]);
	const started = performance.now();
	await settleFrame();
	expect(performance.now() - started).toBeLessThan(250);
});

it(
	"fails the settle within its bound when an animation never ends",
	{ timeout: ANIMATION_WAIT_MS + 5000 },
	async () => {
		const element = document.createElement("p");
		element.dataset.animated = "";
		document.body.append(element);
		const animation = element.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: 100,
			iterations: Infinity,
		});
		try {
			const started = performance.now();
			await expect(settleFrame()).rejects.toThrow(
				`the page did not settle: a Web Animation on <p> still ran after ${ANIMATION_WAIT_MS} ms`,
			);
			expect(performance.now() - started).toBeLessThan(ANIMATION_WAIT_MS + 1000);
		} finally {
			animation.cancel();
		}
	},
);
