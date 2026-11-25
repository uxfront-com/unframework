// transitions/directive: a `.uf.ts` module's directive on the element of a `<Transition>` that
// leaves (ADR-0100, amending ADR-0099). Once the leave has ended, the element is gone and the
// directive's `unmounted` has run exactly once. Whether it ran when the leave
// started or when it ended is the target's, so the test reads it only after the leave. The harness
// gives no transition a duration (plan §7.6), so the second test gives the case's `-active`
// classes one for itself.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Banner from "./Banner.uf.tsx";

/** Records the `unmounted` calls the directive reports on the document, for one element. */
function record(element: Element): { calls: () => string[]; stop: () => void } {
	const calls: string[] = [];
	const listener = (event: Event) => {
		if ((event as CustomEvent<Element>).detail === element) calls.push("unmounted");
	};
	document.addEventListener("mark-unmounted", listener);
	return {
		calls: () => calls,
		stop: () => document.removeEventListener("mark-unmounted", listener),
	};
}

describeTargets("transitions/directive", () => {
	it("renders the banner", async () => {
		const view = await mountScenario(Banner, "default");
		await view.expectParity("default");
		await expect.element(view.getByText("New releases are out.")).toBeVisible();
	});

	it(
		"has run unmounted once by the end of the leave",
		{ requires: ["transition", "interactivity", "directive"] },
		async () => {
			const style = document.createElement("style");
			// A class beats the harness's `*` among `!important` declarations.
			style.textContent = ".fade-leave-active { transition: all 200ms linear !important; }";
			document.head.append(style);
			try {
				const view = await mountScenario(Banner, "default");
				const banner = view.container.querySelector(".banner")!;
				const trace = record(banner);
				try {
					await view.user.click(view.getByRole("button", { name: "Dismiss" }));
					await view.expectParity("dismissed");
					expect(banner.isConnected).toBe(false);
					expect(trace.calls()).toEqual(["unmounted"]);
					await expect.element(view.getByRole("button", { name: "Dismiss" })).toBeVisible();
				} finally {
					trace.stop();
				}
			} finally {
				style.remove();
			}
		},
	);
});
