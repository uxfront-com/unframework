// fallthrough/attributes: a consumer's attributes that the child does not declare land on its
// root element (ADR-0118): an `id`, ARIA and `data-*` attributes, a bound `aria-pressed` that
// follows state, and `type`, where the consumer's value wins over the root's own. `title` is a
// prop the child declares and renders as text, so it never reaches the root as an attribute.
import { describeTargets, it, mount } from "@unframework.dev/testing";
import { expect } from "vitest";

import Editor from "./Editor.uf.tsx";

describeTargets("fallthrough/attributes", () => {
	it("puts the attributes on the root", async () => {
		const view = await mount(Editor);
		await view.expectParity("initial");
		const save = view.getByRole("button", { name: "Save" });
		await expect.element(save).toHaveAttribute("id", "save");
		await expect.element(save).toHaveAttribute("aria-describedby", "save-hint");
		await expect.element(save).toHaveAttribute("aria-pressed", "false");
		await expect.element(save).toHaveAttribute("data-testid", "save-button");
		await expect.element(save).toHaveAttribute("type", "submit");
		await expect.element(save).toHaveClass("button", "primary");
		await expect.element(save).toHaveAccessibleDescription("Saves the draft.");
		await expect.element(save).not.toHaveAttribute("title");
	});

	it("updates a bound attribute", { requires: ["interactivity"] }, async () => {
		const view = await mount(Editor);
		await view.user.click(view.getByRole("button", { name: "Toggle" }));
		await view.expectParity("toggled");
		await expect
			.element(view.getByRole("button", { name: "Save" }))
			.toHaveAttribute("aria-pressed", "true");
	});
});
