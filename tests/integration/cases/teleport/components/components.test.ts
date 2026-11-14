// teleport/components: teleports that components hold (ADR-0098). Each tip is a component whose
// whole render is a teleport: reversing the keyed list moves the components, and what they
// teleported stays where it mounted, on every target (Qwik moves a component's nodes with it, and
// its helper puts the element back). A teleport filled into a child's default slot mounts only
// while the child renders the slot (Angular creates projected content whether or not it renders),
// and unmounts when the slot goes.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Board from "./Board.uf.tsx";

const tips = () =>
  [...document.querySelectorAll("body > .tip")].map((tip) => tip.textContent?.trim());

describeTargets("teleport/components", () => {
  it("mounts each tip, and nothing the closed card holds", { requires: ["teleport"] }, async () => {
    const view = await mountScenario(Board, "default");
    await view.expectParity("default");
    await expect.element(view.getByText("Alpha tip")).toBeVisible();
    await expect.element(view.getByText("Slotted")).not.toBeInTheDocument();
    expect(tips()).toEqual(["Alpha tip", "Beta tip"]);
  });

  it(
    "keeps the tips where they mounted as their components reorder",
    { requires: ["teleport", "interactivity", "keyed-identity"] },
    async () => {
      const view = await mountScenario(Board, "default");
      await view.user.click(view.getByRole("button", { name: "Reverse tips" }));
      await view.expectParity("reversed");
      await expect.element(view.getByText("Beta tip")).toBeVisible();
      expect(tips()).toEqual(["Alpha tip", "Beta tip"]);
    },
  );

  it(
    "mounts the slotted teleport while the card renders its slot",
    { requires: ["teleport", "interactivity"] },
    async () => {
      const view = await mountScenario(Board, "default");
      await view.user.click(view.getByRole("button", { name: "Toggle card" }));
      await view.expectParity("open");
      await expect.element(view.getByText("Slotted")).toBeVisible();
      expect(document.querySelector(".slotted")?.parentElement).toBe(document.body);
      await view.user.click(view.getByRole("button", { name: "Toggle card" }));
      await view.expectParity("closed");
      await expect.element(view.getByRole("button", { name: "Toggle card" })).toBeVisible();
      await expect.element(view.getByText("Slotted")).not.toBeInTheDocument();
    },
  );
});
