// async-setup/resolved: a setup that awaits a user, then a ref that starts from it (ADR-0101).
// In the hydrate projects the click lands once the setup has run again on the client.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Profile from "./Profile.uf.tsx";

describeTargets("async-setup/resolved", () => {
	it("renders what the setup awaited", async () => {
		const view = await mountScenario(Profile, "ada");
		await view.expectParity("ada");
		await expect.element(view.getByRole("paragraph")).toHaveTextContent("User ada Visits: 3");
		await expect.element(view.getByRole("button")).toHaveTextContent("Visits: 3");
	});

	it("counts from the awaited value", { requires: ["interactivity"] }, async () => {
		const view = await mountScenario(Profile, "ada");
		await view.user.click(view.getByRole("button", { name: "Visits: 3" }));
		await view.expectParity("after-click");
		await expect.element(view.getByRole("button")).toHaveTextContent("Visits: 4");
	});
});
