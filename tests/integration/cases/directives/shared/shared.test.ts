// directives/shared: `vMark`, from one `.uf.ts` module, applied in two components (ADR-0099).
// Its `mounted` writes `data-directive-mounted`, which only the browser runs: the server's HTML
// holds no marker (L6), and the DOM holds one on each element once mounted (L7), and once the
// server's HTML hydrates (L12).
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Labels from "./Labels.uf.tsx";

describeTargets("directives/shared", () => {
	it("marks both components' elements once mounted", { requires: ["directive"] }, async () => {
		const view = await mountScenario(Labels, "initial");
		await view.expectParity("initial");
		await expect.element(view.getByText("New")).toHaveAttribute("data-directive-mounted", "badge");
		await expect
			.element(view.getByText("#docs"))
			.toHaveAttribute("data-directive-mounted", "tag docs");
	});
});
