// teleport/root: a component whose whole render is a `<Teleport>` (ADR-0098), with a sheet of its
// own, under a styled parent. The teleported element carries the child's scope attribute, so the
// child's `.toast` rule styles it (L10), and the parent's rules, scoped to the parent's elements,
// reach none of it: not `.page div`, which no longer contains it, and not the parent's own
// `.toast`. No target warns about the parent's scope attribute, which a teleport root takes
// nowhere (L13).
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Page from "./Page.uf.tsx";

describeTargets("teleport/root", () => {
	it("styles the teleported element as the child alone", { requires: ["teleport"] }, async () => {
		const view = await mountScenario(Page, "default");
		await view.expectParity("default");
		await expect.element(view.getByRole("alert")).toHaveTextContent("Draft saved");
		const toast = document.querySelector<HTMLElement>("body > .toast")!;
		expect(getComputedStyle(toast).borderTopWidth).toBe("2px");
		expect(getComputedStyle(toast).color).not.toBe("rgb(160, 0, 0)");
	});
});
