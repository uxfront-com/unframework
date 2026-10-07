// events/custom-controls: a listener that writes its own element, and a function two listeners
// share. The comment box's `input` listener sets the textarea's own height from its line count
// through `event.currentTarget`, beside a meter whose `style` the template binds: the height it
// wrote survives the renders the meter causes. The Like control's `toggleLike(event: MouseEvent |
// KeyboardEvent)` is the click listener and is called by the key listener, which prevents Space
// (the page would scroll) and toggles on Enter and Space.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import CommentCard from "./CommentCard.uf.tsx";

describeTargets("events/custom-controls", () => {
  it("renders the empty comment", async () => {
    const view = await mountScenario(CommentCard, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByText("0 characters")).toBeVisible();
    await expect
      .element(view.getByRole("button", { name: "Like" }))
      .toHaveAttribute("aria-pressed", "false");
  });

  it(
    "grows the comment box with its lines, beside the meter",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(CommentCard, "initial");
      await view.user.type(view.getByRole("textbox", { name: "Comment" }), "a{Enter}b{Enter}c");
      await view.expectParity("three-lines");
      await expect.element(view.getByText("5 characters")).toBeVisible();
      await expect
        .element(view.getByRole("textbox", { name: "Comment" }))
        .toHaveAttribute("style", "height: 4.5em;");
      await view.user.keyboard("d");
      await view.expectParity("longer-line");
      await expect.element(view.getByText("6 characters")).toBeVisible();
      await expect
        .element(view.getByRole("textbox", { name: "Comment" }))
        .toHaveAttribute("style", "height: 4.5em;");
    },
  );

  it("likes with a click, Enter and Space", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(CommentCard, "initial");
    await view.user.click(view.getByRole("button", { name: "Like" }));
    await view.expectParity("liked");
    await expect
      .element(view.getByRole("button", { name: "Like" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(view.emitted("liked")).toEqual([[true, "click"]]);
    await view.user.keyboard("{Enter}");
    await view.user.keyboard(" ");
    await view.expectParity("liked-by-keys");
    await expect
      .element(view.getByRole("button", { name: "Like" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(view.emitted("liked")).toEqual([
      [true, "click"],
      [false, "keydown"],
      [true, "keydown"],
    ]);
  });
});
