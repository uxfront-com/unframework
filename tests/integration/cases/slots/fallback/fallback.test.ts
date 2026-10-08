// slots/fallback: a notice renders fallback content for its default and its action slots
// (ADR-0054). One parent fills both, the other leaves them empty.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Board from "./Board.uf.tsx";

describeTargets("slots/fallback", () => {
  it("renders the fills and the fallbacks", async () => {
    const view = await mountScenario(Board, "failed");
    await view.expectParity("failed");
    await expect.element(view.getByText("Build #42 failed.")).toBeVisible();
    await expect.element(view.getByRole("link", { name: "See the logs" })).toBeVisible();
    await expect
      .element(view.getByRole("note", { name: "Deploy" }))
      .toHaveTextContent("Nothing to report.No action");
  });
});
