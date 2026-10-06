// control-flow/keyed-map: a list of objects mapped to table rows, keyed by a string; the rows
// render in the array's order. M1 checks content and order only, not DOM identity (ADR-0036).
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import ContributorTable from "./ContributorTable.uf.tsx";

describeTargets("control-flow/keyed-map", () => {
  it("renders one row per object, in order", async () => {
    const view = await mountScenario(ContributorTable, "by-commits");
    await view.expectParity("by-commits");
    await expect.element(view.getByRole("table", { name: "Top contributors" })).toBeVisible();
    // Row 0 holds the column headers.
    const first = view.getByRole("row").nth(1);
    await expect.element(first.getByRole("cell").nth(0)).toHaveTextContent("Ada Lovelace");
    await expect.element(first.getByRole("cell").nth(1)).toHaveTextContent("120");
    const last = view.getByRole("row").nth(3);
    await expect.element(last.getByRole("cell").nth(0)).toHaveTextContent("Alan Turing");
    await expect
      .element(view.getByRole("link", { name: "Grace Hopper" }))
      .toHaveAttribute("href", "https://example.com/people/grace");
  });

  it("renders the same objects in another order", async () => {
    const view = await mountScenario(ContributorTable, "by-name");
    await view.expectParity("by-name");
    await expect.element(view.getByRole("table", { name: "Contributors by name" })).toBeVisible();
    const first = view.getByRole("row").nth(1);
    await expect.element(first.getByRole("cell").nth(0)).toHaveTextContent("Alan Turing");
    await expect.element(first.getByRole("cell").nth(1)).toHaveTextContent("42");
    const last = view.getByRole("row").nth(3);
    await expect.element(last.getByRole("cell").nth(0)).toHaveTextContent("Grace Hopper");
  });
});
