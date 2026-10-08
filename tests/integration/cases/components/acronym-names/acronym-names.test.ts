// components/acronym-names: props named `imageURL` and `userID` and an event named `pickedURL`
// keep their names through every target's spelling (ADR-0053).
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Profile from "./Profile.uf.tsx";

describeTargets("components/acronym-names", () => {
  it("passes the props", async () => {
    const view = await mount(Profile);
    await view.expectParity("initial");
    await expect.element(view.getByRole("button")).toHaveTextContent("User 7: /a.png");
  });

  it("hears the event", { requires: ["interactivity"] }, async () => {
    const view = await mount(Profile);
    await view.user.click(view.getByRole("button"));
    await view.expectParity("picked");
    await expect.element(view.getByRole("status")).toHaveTextContent("Picked: /a.png");
  });
});
