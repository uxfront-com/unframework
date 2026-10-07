// semantics/nested-branches: a conditional whose branch is a conditional of its own renders a
// new element when the outer branch changes, as Vue does, so the focus leaves the button the
// click removed (React keys nested branches apart). A branch narrowed by `!== null` on a state
// reads the narrowed value's member, and a handler in a branch narrowed on a prop reads the
// narrowed prop.
import { describeTargets, it, mount, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import AccountMenu from "./AccountMenu.uf.tsx";

describeTargets("semantics/nested-branches", () => {
  it("renders the first step and the owner", async () => {
    const view = await mountScenario(AccountMenu, "with-owner");
    await view.expectParity("with-owner");
    await expect.element(view.getByRole("button", { name: "Start" })).toBeVisible();
    await expect.element(view.getByText("Nobody signed in")).toBeVisible();
  });

  it(
    "renders a new button when a branch changes, so the focus leaves it",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(AccountMenu, "with-owner");
      await view.user.click(view.getByRole("button", { name: "Start" }));
      await view.expectParity("started");
      await expect.element(view.getByRole("button", { name: "Sign in" })).toBeVisible();
      await expect.element(view.getByRole("button", { name: "Sign in" })).not.toHaveFocus();
      await view.user.click(view.getByRole("button", { name: "Sign in" }));
      await view.expectParity("signed-in");
      await expect.element(view.getByText("Signed in as Ada")).toBeVisible();
      await expect.element(view.getByRole("button", { name: "Sign out" })).not.toHaveFocus();
    },
  );

  // Browser-only: a rerender has no server twin.
  it(
    "greets the owner from a handler in the branch the owner narrows",
    { requires: ["interactivity"] },
    async () => {
      const view = await mount(AccountMenu, { props: { owner: { name: "Grace" } } });
      await view.user.click(view.getByRole("button", { name: "Greet Grace" }));
      await view.rerender({ owner: { name: "Linus" } });
      await view.user.click(view.getByRole("button", { name: "Greet Linus" }));
      await view.expectParity("greeted");
      await expect.element(view.getByRole("button", { name: "Greet Linus" })).toBeVisible();
      expect(view.emitted("greeted")).toEqual([["Grace"], ["Linus"]]);
    },
  );
});
