// A component that leaves an element in `body` once it is unmounted, as a teleport whose content
// outlives its component would (ADR-0098): the after-test check fails L8, naming the element.
// It fails on purpose: test/leak.test.ts runs it and reads the matrix.
import { expect } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, it, mount } from "../../../../../src/index.ts";
import type { StubComponent } from "../../../dom-target.ts";
import "../../../dom-target.ts";

/** A toast in `body` that nothing removes. */
const leaking: StubComponent = {
	html: "<p>In place</p>",
	setup() {
		if (document.querySelector("body > .toast")) {
			return;
		}
		const toast = document.createElement("div");
		toast.className = "toast";
		toast.textContent = "Saved";
		document.body.append(toast);
	},
};

describeTargets("stub/leak", () => {
	it("leaves a toast in body", async () => {
		const view = await mount(leaking);
		expect(view.html()).toContain("Saved");
	});
});
