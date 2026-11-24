// fallthrough/rest: a field turns fallthrough off and spreads its props' rest on its <input>
// (ADR-0118), so what its consumer passes (an `id`, `aria-describedby`, `placeholder`, a
// `class`, a `style` and an `onFocus`) lands on the input and not on its root <label>.
import { describeTargets, it, mount } from "@unframework.dev/testing";
import { expect } from "vitest";

import SignUp from "./SignUp.uf.tsx";

describeTargets("fallthrough/rest", () => {
  it("puts what the consumer passes on the input", async () => {
    const view = await mount(SignUp);
    await view.expectParity("initial");
    const email = view.getByRole("textbox", { name: "Email" });
    await expect.element(email).toHaveAttribute("id", "email");
    await expect.element(email).toHaveAttribute("placeholder", "you@example.com");
    await expect.element(email).toHaveAccessibleDescription("We never share it.");
    await expect.element(email).toHaveClass("wide");
    await expect.element(email).toHaveStyle({ marginTop: "4px" });
    await expect.element(email).toHaveAttribute("name", "email");
    const label = view.getByText("Email", { exact: true });
    await expect.element(label).toHaveClass("field", { exact: true });
    await expect.element(label).not.toHaveAttribute("id");
  });

  it("fires the listener from the input", { requires: ["interactivity"] }, async () => {
    const view = await mount(SignUp);
    await view.user.click(view.getByRole("textbox", { name: "Email" }));
    await view.expectParity("focused");
    await expect.element(view.getByText("Focuses: 1")).toBeVisible();
  });
});
