// dev/setup-warning: a top-level `if (isDev)` block warns where the setup runs, in a development
// build, when the button has no accessible name (ADR-0117). The server render passes a `label`,
// since L13 judges the server's console with no allowance; the browser mounts it without one.
import {
	allowConsole,
	capturedConsole,
	describeTargets,
	it,
	mount,
} from "@unframework.dev/testing";
import { expect } from "vitest";

import IconButton from "./IconButton.uf.tsx";

const WARNING = /IconButton has no accessible name/;

describeTargets("dev/setup-warning", () => {
	it("warns its author when it has no accessible name", async () => {
		allowConsole(WARNING, "The development-only warning this case checks for (ADR-0117).");
		// Browser-only: its server twin would warn, and L13 judges the server's console with no
		// allowance, so `case.json`'s scenario passes a `label`.
		const view = await mount(IconButton);
		await view.expectParity("unlabelled");
		await expect.element(view.getByRole("button")).toBeVisible();
		// Present, never counted: React may run its body more than once (ADR-0117).
		expect(capturedConsole().some(({ message }) => WARNING.test(message))).toBe(true);
	});
});
