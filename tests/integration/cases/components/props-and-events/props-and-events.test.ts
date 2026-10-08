// components/props-and-events: a parent renders a child twice, imported from the child's own
// file (ADR-0053). It passes a static prop, a bound one and leaves another to its default, and
// listens to the child's event with a local function and with an arrow function. The parent
// shows the payload it received.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Form from "./Form.uf.tsx";

describeTargets("components/props-and-events", () => {
  it("renders each child with its props", async () => {
    const view = await mountScenario(Form, "lisbon");
    await view.expectParity("lisbon");
    await expect.element(view.getByRole("button", { name: "Clear Street" })).toBeVisible();
    await expect.element(view.getByRole("button", { name: "Clear Lisbon" })).toBeVisible();
    await expect.element(view.getByRole("status")).toHaveTextContent("Cleared: nothing");
  });

  it("hears each child's event", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Form, "lisbon");
    await view.user.click(view.getByRole("button", { name: "Clear Lisbon" }));
    await view.expectParity("after-lisbon");
    await expect.element(view.getByRole("status")).toHaveTextContent("Cleared: LISBON");
    await view.user.click(view.getByRole("button", { name: "Clear Street" }));
    await view.expectParity("after-street");
    await expect.element(view.getByRole("status")).toHaveTextContent("Cleared: Street");
  });
});
