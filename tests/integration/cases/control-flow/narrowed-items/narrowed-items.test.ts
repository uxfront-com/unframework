// control-flow/narrowed-items: a keyed list's row narrows its item as the source's TypeScript
// does: an optional member under a test, a discriminant in an attribute, and a branch whose
// handler reads what its test narrows (ADR-0096: Solid reads a row's item through a getter, which
// TypeScript narrows, where it would narrow no call).
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Reading from "./Reading.uf.tsx";

describeTargets("control-flow/narrowed-items", () => {
	it("renders each source by its kind", async () => {
		const view = await mountScenario(Reading, "initial");
		await view.expectParity("initial");
		await expect.element(view.getByText("2. SICP (chapter 3)")).toBeVisible();
		await expect
			.element(view.getByRole("listitem").first())
			.toHaveAttribute("title", "https://html.spec.whatwg.org/");
		await expect
			.element(view.getByRole("button", { name: "Open The HTML standard" }))
			.toBeVisible();
	});

	it("emits the link's address", { requires: ["interactivity"] }, async () => {
		const view = await mountScenario(Reading, "initial");
		await view.user.click(view.getByRole("button", { name: "Open The HTML standard" }));
		await view.expectParity("opened");
		await expect.element(view.getByText("3. TAOCP")).toBeVisible();
		expect(view.emitted("open")).toEqual([["https://html.spec.whatwg.org/"]]);
	});
});
