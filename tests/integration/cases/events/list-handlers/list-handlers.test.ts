// events/list-handlers: handlers inside `.map` that pass the item and its index to a setup
// function. After a removal, a row's index is its new position. The selection lives in a ref of
// its own, and no row is replaced or reordered while focus is in the list (semantics contract,
// keyed lists).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import ContactList from "./ContactList.uf.tsx";

describeTargets("events/list-handlers", () => {
  it("renders the contacts", async () => {
    const view = await mountScenario(ContactList, "initial");
    await view.expectParity("initial");
    await expect
      .element(view.getByRole("button", { name: "Grace Hopper", exact: true }))
      .toBeVisible();
    await expect.element(view.getByRole("status")).toHaveTextContent("Chosen: nobody");
  });

  it("passes the item and its index to the handler", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(ContactList, "initial");
    await view.user.click(view.getByRole("button", { name: "Grace Hopper", exact: true }));
    await view.expectParity("picked-grace");
    await expect.element(view.getByRole("status")).toHaveTextContent("Chosen: grace");
    await expect
      .element(view.getByRole("button", { name: "Grace Hopper", exact: true }))
      .toHaveAttribute("aria-pressed", "true");
    expect(view.emitted("choose")).toEqual([["grace", 1]]);
  });

  it("removes a row, then reads the new index", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(ContactList, "initial");
    await view.user.click(view.getByRole("button", { name: "Remove Ada Lovelace" }));
    await view.user.click(view.getByRole("button", { name: "Grace Hopper", exact: true }));
    await view.expectParity("removed-ada");
    // The row's text also holds its Remove button's: read its contact button.
    await expect
      .element(view.getByRole("listitem").nth(0).getByRole("button").first())
      .toHaveTextContent("Grace Hopper");
    expect(view.emitted("removed")).toEqual([["Ada Lovelace"]]);
    expect(view.emitted("choose")).toEqual([["grace", 0]]);
  });
});
