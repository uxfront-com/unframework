// effects/flush-post: a watcher with `{ flush: "post" }` runs after the DOM has updated, so it
// reads the new list through a template ref. It reads a fact that does not depend on layout, the
// number of rows.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import MessageList from "./MessageList.uf.tsx";

describeTargets("effects/flush-post", () => {
  it("renders the first message", async () => {
    const view = await mountScenario(MessageList, "initial");
    await view.expectParity("initial");
    await expect
      .element(view.getByRole("listitem").nth(0))
      .toHaveTextContent("Welcome to the team");
  });

  it("reads the updated DOM after each change", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(MessageList, "initial");
    await view.user.click(view.getByRole("button", { name: "Add a message" }));
    await view.user.click(view.getByRole("button", { name: "Add a message" }));
    await view.expectParity("three-messages");
    await expect.element(view.getByRole("listitem").nth(2)).toHaveTextContent("Message 3");
    expect(view.emitted("rendered")).toEqual([[2], [3]]);
  });
});
