// dynamic/default-slot: a `<component is>` over tags renders the default slot in whichever tag
// renders, or the slot's fallback when the parent leaves it empty (ADR-0054, ADR-0124). Angular
// writes one `@case` per tag and projects content into one `<ng-content>` only, so it declares the
// slot once, before its `@switch`, and each case renders it.
import { describeTargets, it, mount } from "@unframework.dev/testing";
import { expect } from "vitest";

import Page from "./Page.uf.tsx";

describeTargets("dynamic/default-slot", () => {
	it("renders the fill, or the fallback, in each tag", async () => {
		const view = await mount(Page);
		await view.expectParity("initial");
		const docs = view.getByRole("link", { name: "Read the docs" });
		await expect.element(docs).toHaveAttribute("href", "#docs");
		await expect.element(docs.getByText("Read the docs")).toHaveAttribute("data-slot", "label");
		await expect.element(view.getByRole("button", { name: "Save the draft" })).toHaveClass("action");
		// The parent leaves the slot empty: the label renders as its fallback.
		await expect.element(view.getByRole("link", { name: "Home" })).toHaveAttribute("href", "#home");
		await expect.element(view.getByRole("button", { name: "Close" })).toHaveClass("action");
		const more = view.getByRole("link", { name: "Learn more" });
		await expect.element(more).toHaveAttribute("href", "#more");
		await expect.element(more.getByText("+")).toHaveAttribute("aria-hidden", "true");
	});

	it("keeps the fill as the tag changes", { requires: ["interactivity"] }, async () => {
		const view = await mount(Page);
		const toggle = view.getByRole("button", { name: "Toggle" });
		await view.user.click(toggle);
		await view.expectParity("button");
		const more = view.getByRole("button", { name: "Learn more" });
		await expect.element(more).not.toHaveAttribute("href");
		await expect.element(more.getByText("+")).toBeInTheDocument();
		await expect.element(view.getByRole("link", { name: "Learn more" })).not.toBeInTheDocument();
		expect(view.getByText("Learn more").elements()).toHaveLength(1);
		await view.user.click(toggle);
		await view.expectParity("link");
		await expect
			.element(view.getByRole("link", { name: "Learn more" }))
			.toHaveAttribute("href", "#more");
		await expect.element(view.getByRole("button", { name: "Learn more" })).not.toBeInTheDocument();
		expect(view.getByText("Learn more").elements()).toHaveLength(1);
	});
});
