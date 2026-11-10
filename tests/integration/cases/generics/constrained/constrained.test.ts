// generics/constrained: `T extends { id: string; label: string }`, whose members key and label
// the rows (ADR-0068).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Table from "./Table.uf.tsx";

/** A row of the scenario: more than the constraint declares. */
interface Person {
  id: string;
  label: string;
  born: number;
}

describeTargets("generics/constrained", () => {
  it("renders a row for each item", async () => {
    const view = await mountScenario(Table<Person>, "people");
    await view.expectParity("people");
    await expect.element(view.getByRole("table", { name: "People" })).toBeVisible();
    await expect.element(view.getByRole("rowheader", { name: "ada" })).toBeVisible();
    await expect.element(view.getByRole("cell", { name: "Grace Hopper" })).toBeVisible();
  });
});
