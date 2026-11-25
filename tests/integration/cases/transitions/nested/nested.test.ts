// transitions/nested: a `<Transition>` of one element without `appear` inside another
// transition's element (ADR-0100). When the outer transition's element enters again, the inner
// transition mounts anew, and without `appear` its first element runs no enter, as on Vue. The
// outer element's own enter is the positive control. The harness gives no transition a duration
// (plan §7.6), so the second test gives the case's `-active` classes one, and watches the classes
// from before the step.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Accordion from "./Accordion.uf.tsx";

describeTargets("transitions/nested", () => {
	it("renders the open panel", async () => {
		const view = await mountScenario(Accordion, "open");
		await view.expectParity("open");
		await expect.element(view.getByText("Ships in two days.")).toBeVisible();
	});

	it(
		"runs no enter on the inner transition when the outer one's element enters again",
		{ requires: ["transition", "interactivity"] },
		async () => {
			const style = document.createElement("style");
			// A class beats the harness's `*` among `!important` declarations.
			style.textContent =
				".outer-enter-active, .outer-leave-active, .inner-enter-active, .inner-leave-active { transition: all 200ms linear !important; }";
			document.head.append(style);
			try {
				const view = await mountScenario(Accordion, "open");
				await view.user.click(view.getByRole("button", { name: "Shipping" }));
				await view.expectParity("closed");
				await expect
					.element(view.getByRole("button", { name: "Shipping" }))
					.toHaveAttribute("aria-expanded", "false");
				const seen = new Set<string>();
				const take = (element: Element) => {
					for (const name of element.classList) {
						if (name.startsWith("outer-") || name.startsWith("inner-")) seen.add(name);
					}
				};
				const observer = new MutationObserver((records) => {
					for (const each of records) {
						if (each.target instanceof Element) take(each.target);
						for (const node of each.addedNodes) {
							if (node instanceof Element) [node, ...node.querySelectorAll("*")].forEach(take);
						}
					}
				});
				observer.observe(view.container, {
					subtree: true,
					childList: true,
					attributes: true,
					attributeFilter: ["class"],
				});
				try {
					await view.user.click(view.getByRole("button", { name: "Shipping" }));
					await view.expectParity("reopened");
					observer.takeRecords().forEach((each) => {
						if (each.target instanceof Element) take(each.target);
					});
				} finally {
					observer.disconnect();
				}
				await expect.element(view.getByText("Ships in two days.")).toBeVisible();
				expect([...seen].toSorted()).toEqual([
					"outer-enter-active",
					"outer-enter-from",
					"outer-enter-to",
				]);
			} finally {
				style.remove();
			}
		},
	);
});
