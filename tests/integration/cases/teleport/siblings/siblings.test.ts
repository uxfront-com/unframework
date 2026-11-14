// teleport/siblings: teleports among siblings that change (ADR-0098). Two teleports mount in
// source order, after one per row of a keyed list. A conditional and a list that grows are
// inserted before them, which Qwik inserts before the first DOM node of what follows (the
// teleport's anchor, never its moved element). Reversing the rows moves the rows, not what
// they teleported, on every target. Removing the panel removes all of it from `body`.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Board from "./Board.uf.tsx";

const teleported = () =>
  [...document.body.querySelectorAll(":scope > [data-teleported]")].map((element) =>
    element.textContent?.trim(),
  );

describeTargets("teleport/siblings", () => {
  it("mounts every teleport in source order", { requires: ["teleport"] }, async () => {
    const view = await mountScenario(Board, "default");
    await view.expectParity("default");
    expect(teleported()).toEqual(["First", "Second", "Alpha tip", "Beta tip"]);
  });

  it(
    "keeps the teleports as nodes are inserted before them",
    { requires: ["teleport", "interactivity"] },
    async () => {
      const view = await mountScenario(Board, "default");
      await view.user.click(view.getByRole("button", { name: "Show note" }));
      await view.user.click(view.getByRole("button", { name: "Add extra" }));
      await view.user.click(view.getByRole("button", { name: "Add extra" }));
      await view.expectParity("inserted");
      await expect.element(view.getByText("Note")).toBeVisible();
      await expect.element(view.getByText("Extra 2")).toBeVisible();
      expect(teleported()).toEqual(["First", "Second", "Alpha tip", "Beta tip"]);
    },
  );

  it(
    "moves the rows and keeps what they teleported",
    { requires: ["teleport", "interactivity"] },
    async () => {
      const view = await mountScenario(Board, "default");
      await view.user.click(view.getByRole("button", { name: "Reverse rows" }));
      await view.expectParity("reversed");
      await expect.element(view.getByRole("listitem").first()).toHaveTextContent("Beta");
      expect(teleported()).toEqual(["First", "Second", "Alpha tip", "Beta tip"]);
    },
  );

  it(
    "clears body when the panel goes",
    { requires: ["teleport", "interactivity"] },
    async () => {
      const view = await mountScenario(Board, "default");
      await view.user.click(view.getByRole("button", { name: "Remove panel" }));
      await view.expectParity("removed");
      expect(teleported()).toEqual([]);
    },
  );
});
