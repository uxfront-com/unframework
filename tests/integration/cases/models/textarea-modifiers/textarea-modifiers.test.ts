// models/textarea-modifiers: `v-model`'s modifiers on a <textarea> (ADR-0054). The server renders
// the field's first value as its text, and what the user types stays in the field while the
// trimmed or lazy value reaches the state.
import { describeTargets, it, mount } from "@unframework.dev/testing";
import { expect } from "vitest";

import Reply from "./Reply.uf.tsx";

describeTargets("models/textarea-modifiers", () => {
  it("shows the state in the fields", async () => {
    const view = await mount(Reply);
    await view.expectParity("initial");
    await expect
      .element(view.getByRole("textbox", { name: "Message" }))
      .toHaveValue("Thanks, see you soon");
    await expect.element(view.getByRole("textbox", { name: "Signature" })).toHaveValue("Ada");
    await expect
      .element(view.getByRole("status"))
      .toHaveTextContent("[Thanks, see you soon] from Ada");
  });

  it(
    "trims what the user types, and keeps it in the field",
    { requires: ["interactivity"] },
    async () => {
      const view = await mount(Reply);
      const message = view.getByRole("textbox", { name: "Message" });
      await view.user.fill(message, "  See you at noon  ");
      await view.expectParity("typed");
      await expect
        .element(view.getByRole("status"))
        .toHaveTextContent("[See you at noon] from Ada");
      await expect.element(message).toHaveValue("  See you at noon  ");
    },
  );

  it("writes a lazy field on change", { requires: ["interactivity"] }, async () => {
    const view = await mount(Reply);
    await view.user.fill(view.getByRole("textbox", { name: "Signature" }), "Grace");
    await view.expectParity("before-change");
    await expect
      .element(view.getByRole("status"))
      .toHaveTextContent("[Thanks, see you soon] from Ada");
    await view.user.tab();
    await view.expectParity("after-change");
    await expect
      .element(view.getByRole("status"))
      .toHaveTextContent("[Thanks, see you soon] from Grace");
  });
});
