// fallthrough/root-ref: a ref on a component that exposes nothing holds its root element
// (ADR-0118), an <input>, which the parent focuses. The component's own template ref on the
// same element still works: `onMounted` reads it, and its focus listener then fills the field. A component that
// turns fallthrough off still gives a ref its root element, as Vue's `$el` does.
import { describeTargets, it, mount } from "@unframework.dev/testing";
import { expect } from "vitest";

import Profile from "./Profile.uf.tsx";

describeTargets("fallthrough/root-ref", () => {
  it("renders the field", async () => {
    const view = await mount(Profile);
    await view.expectParity("initial");
    await expect.element(view.getByRole("textbox", { name: "Name" })).toHaveValue("");
  });

  it(
    "holds the root element in the parent's ref and the component's own",
    { requires: ["interactivity", "expose"] },
    async () => {
      const view = await mount(Profile);
      await view.user.click(view.getByRole("button", { name: "Edit name" }));
      await view.expectParity("focused");
      await expect.element(view.getByRole("textbox", { name: "Name" })).toHaveFocus();
      await expect.element(view.getByRole("textbox", { name: "Name" })).toHaveValue("Ada");
    },
  );

  it(
    "holds the root element of a component that turns fallthrough off",
    { requires: ["interactivity", "expose"] },
    async () => {
      const view = await mount(Profile);
      await view.user.click(view.getByRole("button", { name: "Edit bio" }));
      await view.expectParity("bio-focused");
      await expect.element(view.getByRole("textbox", { name: "Bio" })).toHaveFocus();
    },
  );
});
