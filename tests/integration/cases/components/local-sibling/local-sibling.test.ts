// components/local-sibling: a component renders a component its file declares without exporting
// it, which becomes a sibling file in every output (plan §4.1, ADR-0053).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Card from "./Card.uf.tsx";

describeTargets("components/local-sibling", () => {
  it("renders the local component twice", async () => {
    const view = await mountScenario(Card, "starred");
    await view.expectParity("starred");
    await expect.element(view.getByRole("heading", { name: "Starred" })).toBeVisible();
    await expect.element(view.getByText("+")).toBeInTheDocument();
  });
});
