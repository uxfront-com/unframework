// async-setup/chained: the second await reads the first's value, and a computed value after them
// reads both (ADR-0101).
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Membership from "./Membership.uf.tsx";

describeTargets("async-setup/chained", () => {
	it("renders what both awaits loaded", async () => {
		const view = await mountScenario(Membership, "ada");
		await view.expectParity("ada");
		await expect.element(view.getByRole("status")).toHaveTextContent("User ada is in Team team-3");
	});
});
