// control-flow/ternary-chains: an else-if chain of conditionals whose branches are text, several
// nodes (a fragment of an element, text and interpolations), a single element, and a final else.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import OrderStatus from "./OrderStatus.uf.tsx";

describeTargets("control-flow/ternary-chains", () => {
  it("renders the text branch", async () => {
    const view = await mountScenario(OrderStatus, "pending");
    await view.expectParity("pending");
    await expect.element(view.getByText("Waiting for payment.")).toBeVisible();
  });

  it("renders the branch of several nodes", async () => {
    const view = await mountScenario(OrderStatus, "shipped");
    await view.expectParity("shipped");
    await expect.element(view.getByText("Shipped", { exact: true })).toBeVisible();
    await expect.element(view.getByText("Shipped with Royal Mail, arriving soon.")).toBeVisible();
  });

  it("renders the element branch of an else-if", async () => {
    const view = await mountScenario(OrderStatus, "delivered");
    await view.expectParity("delivered");
    await expect.element(view.getByText("Delivered")).toBeVisible();
  });

  it("renders the final else branch", async () => {
    const view = await mountScenario(OrderStatus, "cancelled");
    await view.expectParity("cancelled");
    await expect.element(view.getByText("Cancelled")).toBeVisible();
  });
});
