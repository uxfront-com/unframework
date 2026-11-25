// teleport/basic: `<Teleport to="body">` mounts its element at the end of `body` once the
// component has mounted (ADR-0098). The server renders none of it, so the SSR scenario's HTML
// holds the section alone, and Astro, which runs nothing in the browser, renders none of it at
// all. Its text reads the component's state, and its button writes it.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Notice from "./Notice.uf.tsx";

describeTargets("teleport/basic", () => {
	it("mounts the notice at the end of body", { requires: ["teleport"] }, async () => {
		const view = await mountScenario(Notice, "default");
		await view.expectParity("default");
		const notice = view.getByRole("status");
		await expect.element(notice).toHaveTextContent("Your changes are saved (0)");
		// The view's queries reach what the notice holds; the notice itself is the last of `body`.
		expect(document.body.lastElementChild?.classList.contains("notice")).toBe(true);
		expect(view.container.querySelector(".notice")).toBeNull();
	});

	it(
		"updates the state shown in place from a click inside the notice",
		{ requires: ["teleport", "interactivity"] },
		async () => {
			const view = await mountScenario(Notice, "default");
			await view.user.click(view.getByRole("button", { name: "Dismiss" }));
			await view.expectParity("dismissed");
			await expect.element(view.getByText("Dismissed 1 times")).toBeVisible();
			await expect
				.element(view.getByRole("status"))
				.toHaveTextContent("Your changes are saved (1)");
		},
	);
});
