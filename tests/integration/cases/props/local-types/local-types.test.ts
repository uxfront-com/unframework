// props/local-types: props typed by an exported interface that uses a local union alias, a
// nested object member and an array of a local interface.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import ProductSpec from "./ProductSpec.uf.tsx";

describeTargets("props/local-types", () => {
  it("renders the union, the nested object and the array of objects", async () => {
    const view = await mountScenario(ProductSpec, "chair");
    await view.expectParity("chair");
    await expect.element(view.getByRole("heading", { name: "Lounge chair" })).toBeVisible();
    await expect.element(view.getByText("in-stock")).toBeVisible();
    await expect.element(view.getByText("45 × 52 cm")).toBeVisible();
    await expect.element(view.getByText("Walnut (CH-WAL)")).toBeVisible();
  });

  it("renders another value of each type", async () => {
    const view = await mountScenario(ProductSpec, "shelf");
    await view.expectParity("shelf");
    await expect.element(view.getByText("backorder")).toBeVisible();
    await expect.element(view.getByText("31.5 × 12 in")).toBeVisible();
    await expect.element(view.getByRole("listitem")).toHaveTextContent("Black (SH-BLK)");
  });
});
