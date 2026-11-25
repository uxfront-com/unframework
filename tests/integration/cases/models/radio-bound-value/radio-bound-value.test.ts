// models/radio-bound-value: radios and a checkbox group whose `v-model` binds one value, each
// input's `value` bound to a prop's item rather than written as a literal (ADR-0054). The server
// checks the radio whose value the state holds and each box the array holds, as the client does.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Delivery from "./Delivery.uf.tsx";

describeTargets("models/radio-bound-value", () => {
	it("checks the inputs whose bound values the state holds", async () => {
		const view = await mountScenario(Delivery, "options");
		await view.expectParity("options");
		await expect.element(view.getByRole("radio", { name: "express" })).toBeChecked();
		await expect.element(view.getByRole("radio", { name: "standard" })).not.toBeChecked();
		await expect.element(view.getByRole("checkbox", { name: "insurance" })).toBeChecked();
		await expect.element(view.getByRole("checkbox", { name: "gift-wrap" })).not.toBeChecked();
	});

	it("writes the bound values as the user chooses", { requires: ["interactivity"] }, async () => {
		const view = await mountScenario(Delivery, "options");
		await view.user.click(view.getByRole("radio", { name: "standard" }));
		await view.expectParity("standard");
		await expect
			.element(view.getByRole("status"))
			.toHaveTextContent("Speed: standard, extras: insurance");
		await view.user.click(view.getByRole("checkbox", { name: "gift-wrap" }));
		await view.expectParity("gift-wrap");
		await expect
			.element(view.getByRole("status"))
			.toHaveTextContent("Speed: standard, extras: insurance, gift-wrap");
		await expect.element(view.getByRole("radio", { name: "express" })).not.toBeChecked();
	});
});
