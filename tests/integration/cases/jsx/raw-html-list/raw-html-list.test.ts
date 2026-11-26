// jsx/raw-html-list: `innerHTML` on a list's element renders each item's markup (ADR-0097).
import { describeTargets, mountScenario } from "@unframework.dev/testing";
import { expect, it } from "vitest";

import Changelog from "./Changelog.uf.tsx";

describeTargets("jsx/raw-html-list", () => {
	it("renders each item's markup", async () => {
		const view = await mountScenario(Changelog, "default");
		await view.expectParity("default");
		const items = view.getByRole("listitem");
		await expect.element(items.nth(0)).toHaveTextContent("Added raw HTML");
		await expect.element(view.getByText("Added", { exact: true })).toBeVisible();
		await expect.element(view.getByText("key", { exact: true })).toBeVisible();
		await expect
			.element(view.getByRole("link", { name: "with a link" }))
			.toHaveAttribute("href", "#notes");
	});
});
