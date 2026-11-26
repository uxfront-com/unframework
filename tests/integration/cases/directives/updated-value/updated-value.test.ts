// directives/updated-value: `updated` runs after a render in which the directive's value changed
// (ADR-0099), as `Object.is` compares it. A render that changes another state leaves it alone,
// though Vue calls a directive's own `updated` after every update of its component.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Meter from "./Meter.uf.tsx";

describeTargets("directives/updated-value", () => {
	it("writes the first value once mounted", { requires: ["directive"] }, async () => {
		const view = await mountScenario(Meter, "initial");
		await view.expectParity("mounted");
		const output = view.getByText("Level 1");
		await expect.element(output).toHaveAttribute("data-value", "1");
		await expect.element(output).toHaveAttribute("data-updates", "0");
	});

	it("runs updated only when the value changes", { requires: ["directive"] }, async () => {
		const view = await mountScenario(Meter, "initial");
		await view.user.click(view.getByRole("button", { name: "Render again" }));
		await view.expectParity("rendered-again");
		await expect.element(view.getByText("Rendered again 1 times")).toBeVisible();
		const output = view.getByText("Level 1");
		await expect.element(output).toHaveAttribute("data-updates", "0");
		await expect.element(output).not.toHaveAttribute("data-old-value");
		await view.user.click(view.getByRole("button", { name: "Raise" }));
		await view.expectParity("raised");
		const raised = view.getByText("Level 2");
		await expect.element(raised).toHaveAttribute("data-value", "2");
		await expect.element(raised).toHaveAttribute("data-old-value", "1");
		await expect.element(raised).toHaveAttribute("data-updates", "1");
		await view.user.click(view.getByRole("button", { name: "Render again" }));
		await view.expectParity("raised-and-rendered");
		await expect.element(view.getByText("Rendered again 2 times")).toBeVisible();
		await expect.element(view.getByText("Level 2")).toHaveAttribute("data-updates", "1");
	});
});
