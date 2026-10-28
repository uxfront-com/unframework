// generics/select: a generic component's model, typed by its type parameter (ADR-0068), bound by
// a parent both ways.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import SizeForm from "./SizeForm.uf.tsx";

describeTargets("generics/select", () => {
  it("selects the bound option", async () => {
    const view = await mount(SizeForm);
    await view.expectParity("initial");
    await expect.element(view.getByRole("combobox", { name: "Size" })).toHaveValue("m");
    await expect.element(view.getByRole("status")).toHaveTextContent("Chosen: m");
  });

  it("writes the parent's state as the user selects", { requires: ["interactivity"] }, async () => {
    const view = await mount(SizeForm);
    await view.user.selectOptions(view.getByRole("combobox", { name: "Size" }), "l");
    await view.expectParity("large");
    await expect.element(view.getByRole("status")).toHaveTextContent("Chosen: l");
  });
});
