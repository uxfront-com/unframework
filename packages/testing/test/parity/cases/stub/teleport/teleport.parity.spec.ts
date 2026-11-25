// What a view teleported (ADR-0098): a stub that appends a toast to `body`, as a teleport mounts
// its content, and removes it when it unmounts. The DOM and ARIA captures (L7) and the trace
// (L9) show it after the container, the view's queries and `view.user` reach it and what it holds,
// and nothing is left in `body` after the test.
import { expect } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, it, mount } from "../../../../../src/index.ts";
import type { StubComponent } from "../../../dom-target.ts";
import "../../../dom-target.ts";

/** A section in place, and a toast in `body` with a button that dismisses it. */
const toasted: StubComponent = {
	html: "<p>In place</p>",
	setup(_container, _emit, signal) {
		const toast = document.createElement("div");
		toast.className = "toast";
		toast.setAttribute("role", "dialog");
		toast.setAttribute("aria-label", "Saved");
		toast.innerHTML = '<p role="status">Saved</p><button type="button">Dismiss</button>';
		document.body.append(toast);
		toast.querySelector("button")!.addEventListener("click", () => toast.remove(), { signal });
		signal.addEventListener("abort", () => toast.remove());
	},
};

describeTargets("stub/teleport", () => {
	it("captures and queries the toast after the container", async () => {
		const view = await mount(toasted);
		expect(view.html()).toContain("<uf:teleported>");
		await expect.element(view.getByRole("status")).toHaveTextContent("Saved");
		// The teleported element itself, which a query chained from it never matches.
		await expect.element(view.getByRole("dialog", { name: "Saved" })).toBeVisible();
		await expect
			.element(view.getByRole("dialog", { name: "Saved" }).getByRole("button"))
			.toHaveTextContent("Dismiss");
		await view.expectParity("shown");
		await view.user.click(view.getByRole("button", { name: "Dismiss" }));
		expect(view.html()).not.toContain("<uf:teleported>");
		await view.expectParity("dismissed");
	});
});
