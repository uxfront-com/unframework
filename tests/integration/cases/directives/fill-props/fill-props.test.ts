// directives/fill-props: a directive on each element a scoped fill renders, whose value reads the
// fill's props (ADR-0108). When the child passes one row new props, that row's element stays,
// and its directive runs `updated` with the new value, while the parent doesn't render.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Page from "./Page.uf.tsx";

interface Trace {
	call: string;
	el: Element;
}

describeTargets("directives/fill-props", () => {
	it("renders every option", async () => {
		const view = await mountScenario(Page, "initial");
		await view.expectParity("initial");
		await expect.element(view.getByRole("button", { name: "Rename option" })).toBeVisible();
	});

	it("updates the renamed option's element", { requires: ["directive"] }, async () => {
		const traces: Trace[] = [];
		const listener = (event: Event) => void traces.push((event as CustomEvent<Trace>).detail);
		document.addEventListener("directive-trace", listener);
		try {
			const view = await mountScenario(Page, "initial");
			await view.expectParity("traced");
			const option = () => view.container.querySelector('[data-name="option-x"]');
			const before = option();
			const mark = traces.length;
			await view.user.click(view.getByRole("button", { name: "Rename option" }));
			await view.expectParity("renamed");
			expect(option()).toBe(before);
			expect(
				traces.slice(mark).map(({ call, el }) => `${el.getAttribute("data-name")} ${call}`),
			).toEqual(["option-x trace updated Xenon Xray"]);
		} finally {
			document.removeEventListener("directive-trace", listener);
		}
	});
});
