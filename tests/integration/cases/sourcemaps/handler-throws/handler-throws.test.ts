// sourcemaps/handler-throws: an error a click handler throws names its authored line (L14,
// ADR-0078). The handler runs only on the click, so the first render is the same as any button's.
import { describeTargets, it, mount } from "@unframework.dev/testing";
import { expect } from "vitest";

import ChargeButton from "./ChargeButton.uf.tsx";

describeTargets("sourcemaps/handler-throws", () => {
  it("renders the button", async () => {
    const view = await mount(ChargeButton);
    await view.expectParity("initial");
    await expect.element(view.getByRole("button", { name: "Charge" })).toBeVisible();
  });

  it("maps the handler's throw to its line", { requires: ["interactivity"] }, async () => {
    const view = await mount(ChargeButton);
    const button = view.getByRole("button", { name: "Charge" });
    await expect.element(button).toBeVisible();
    await view.expectThrown(() => view.user.click(button));
  });
});
