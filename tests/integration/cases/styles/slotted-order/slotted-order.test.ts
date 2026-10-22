// styles/slotted-order: the order of two children's sheets (ADR-0063). The fill of a
// `<component is>` over Amber and Blue carries both children's `-s`, so their two
// `:slotted(.caption)` rules, of equal specificity, both match it, and the sheet that loads later
// sets its colour. Every target that loads sheets in import order must load the children's in the
// reference's order; Angular and Qwik load them in render order, and skip (`sheet-order`).
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Shelf from "./Shelf.uf.tsx";

describeTargets("styles/slotted-order", () => {
  it(
    "colours the content both children style as the later sheet says",
    { requires: ["sheet-order"] },
    async () => {
      const view = await mount(Shelf);
      await view.expectParity("initial");
      await expect.element(view.getByText("In blue")).toBeVisible();
      await expect.element(view.getByText("In amber")).toBeVisible();
      await expect.element(view.getByText("Warm")).toBeVisible();
      await expect.element(view.getByText("Cool")).toBeVisible();
    },
  );
});
