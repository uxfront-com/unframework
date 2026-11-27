// dynamic/default-slot-branches: a default slot the source renders in more than one place, where
// only one place renders at a time, renders the fill, or the slot's fallback when the parent
// leaves it empty, in whichever place renders (ADR-0124, ADR-0125). Angular projects into one
// `<ng-content>` only, so it declares the slot once and each place renders it.
import { describeTargets, it, mount } from "@unframework.dev/testing";
import { expect } from "vitest";

import Page from "./Page.uf.tsx";

const tips = () =>
	[...document.querySelectorAll("body > .tip")].map((tip) => tip.textContent?.trim());

describeTargets("dynamic/default-slot-branches", () => {
	it("renders the fill, or the fallback, in each tag", async () => {
		const view = await mount(Page);
		await view.expectParity("initial");
		// Under a conditional, in a transition's element and in another slot's fallback.
		for (const [link, button, linkFallback, buttonFallback] of [
			["Read the docs", "Save the draft", "Home", "Close"],
			["Read the guide", "Send the draft", "Blog", "Undo"],
			["Read the FAQ", "Print the draft", "News", "Reset"],
		] as const) {
			await expect.element(view.getByRole("link", { name: link }).getByText(link)).toBeVisible();
			await expect
				.element(view.getByRole("button", { name: button }).getByText(button))
				.toBeVisible();
			await expect
				.element(view.getByRole("link", { name: linkFallback }).getByText(linkFallback))
				.toBeVisible();
			await expect
				.element(view.getByRole("button", { name: buttonFallback }).getByText(buttonFallback))
				.toBeVisible();
			expect(view.getByText(link).elements()).toHaveLength(1);
			expect(view.getByText(button).elements()).toHaveLength(1);
		}
		// In both branches of a conditional, the one that renders.
		const more = view.getByRole("link", { name: "Learn more" });
		await expect.element(more).toHaveAttribute("href", "#more");
		expect(more.getByText("Learn more").element().tagName).toBe("B");
		expect(view.getByText("Mind the gap").element().tagName).toBe("B");
		expect(view.getByText("Welcome back").element().tagName).toBe("B");
		expect(view.getByText("Grace").element().tagName).toBe("B");
		for (const text of ["Learn more", "Mind the gap", "Welcome back", "Grace"]) {
			expect(view.getByText(text).elements()).toHaveLength(1);
		}
	});

	it("renders the fill in the branch that renders", { requires: ["interactivity"] }, async () => {
		const view = await mount(Page);
		await view.user.click(view.getByRole("button", { name: "Toggle link" }));
		await view.user.click(view.getByRole("button", { name: "Toggle emphasis" }));
		await view.user.click(view.getByRole("button", { name: "Toggle user" }));
		await view.expectParity("toggled");
		const more = view.getByRole("button", { name: "Learn more" });
		await expect.element(more).not.toHaveAttribute("href");
		expect(more.getByText("Learn more").element().tagName).toBe("I");
		await expect.element(view.getByRole("link", { name: "Learn more" })).not.toBeInTheDocument();
		expect(view.getByText("Mind the gap").element().tagName).toBe("I");
		expect(view.getByText("Welcome back").element().tagName).toBe("I");
		// The branch's own fallback, where the parent leaves the slot empty.
		expect(view.getByText("Guest").element().tagName).toBe("I");
		await expect.element(view.getByText("Grace")).not.toBeInTheDocument();
		for (const text of ["Learn more", "Mind the gap", "Welcome back", "Guest"]) {
			expect(view.getByText(text).elements()).toHaveLength(1);
		}
		await view.user.click(view.getByRole("button", { name: "Toggle link" }));
		await view.user.click(view.getByRole("button", { name: "Toggle emphasis" }));
		await view.user.click(view.getByRole("button", { name: "Toggle user" }));
		await view.expectParity("restored");
		expect(
			view.getByRole("link", { name: "Learn more" }).getByText("Learn more").element().tagName,
		).toBe("B");
		expect(view.getByText("Mind the gap").element().tagName).toBe("B");
		expect(view.getByText("Welcome back").element().tagName).toBe("B");
		expect(view.getByText("Grace").element().tagName).toBe("B");
		await expect.element(view.getByText("Guest")).not.toBeInTheDocument();
		for (const text of ["Learn more", "Mind the gap", "Welcome back", "Grace"]) {
			expect(view.getByText(text).elements()).toHaveLength(1);
		}
	});

	it(
		"renders the fill, or the fallback, in each tag's teleported tip",
		{ requires: ["interactivity", "teleport"] },
		async () => {
			const view = await mount(Page);
			await view.user.click(view.getByRole("button", { name: "Show tips" }));
			await view.expectParity("tips");
			await expect
				.element(view.getByRole("link", { name: "Tips" }))
				.toHaveAttribute("href", "#tips");
			await expect.element(view.getByRole("button", { name: "Help" })).toBeVisible();
			await expect.element(view.getByRole("link", { name: "About" })).toBeVisible();
			await expect.element(view.getByRole("button", { name: "Hint" })).toBeVisible();
			await expect.element(view.getByText("Linked tip")).toBeVisible();
			expect(tips()).toEqual(["Linked tip", "Button tip", "About", "Hint"]);
		},
	);
});
