// dev/client-warning: `if (isDev)` in a lifecycle hook checks the rendered DOM in a development
// build (ADR-0117). The hook only warns and changes nothing, so the link renders alike
// everywhere, Astro included, which runs no client code and so never warns.
import {
	allowConsole,
	capturedConsole,
	describeTargets,
	it,
	mountScenario,
} from "@unframework.dev/testing";
import { expect } from "vitest";

import IconLink from "./IconLink.uf.tsx";

const WARNING = /IconLink has no accessible name/;
const REASON = "The development-only warning this case checks for (ADR-0117).";

describeTargets("dev/client-warning", () => {
	it("renders the link without a name", async () => {
		// Logged once mounted, where the target runs client code.
		allowConsole(WARNING, REASON);
		const view = await mountScenario(IconLink, "unlabelled");
		await view.expectParity("unlabelled");
		await expect.element(view.getByRole("link")).toBeVisible();
	});

	it(
		"warns its author once mounted when it has no accessible name",
		{ requires: ["interactivity"] },
		async () => {
			allowConsole(WARNING, REASON);
			const view = await mountScenario(IconLink, "warned");
			await view.expectParity("warned");
			// Present, never counted: a framework may mount more than once in development.
			await expect
				.poll(() => capturedConsole().some(({ message }) => WARNING.test(message)))
				.toBe(true);
		},
	);
});
