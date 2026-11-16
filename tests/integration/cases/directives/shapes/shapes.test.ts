// directives/shapes: the shapes a directive's hooks and values take that each output's wrapper
// must keep as written (ADR-0099). The hooks read the module's `hooks` and `element`, names the
// wrappers use too; `updated` declares its own `oldValue`; `mounted` returns its element and
// `unmounted` never reads its own. A conditional narrows one value, which React and Qwik read
// outside it, and two more that a handler reassigns: one a `typeof` narrows, one optional. A
// `<textarea>` with a `v-model` applies two directives, one imported with an element type its
// module names and a hook that reads constants named like its output's imports. Two states take
// the names Qwik's task gives its own context, `track` and `cleanup`.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Profile from "./Profile.uf.tsx";

describeTargets("directives/shapes", () => {
  it(
    "runs each directive once mounted, with the module's own names",
    { requires: ["directive"] },
    async () => {
      const view = await mountScenario(Profile, "initial");
      await view.expectParity("initial");
      const name = view.getByText("Ada");
      await expect.element(name).toHaveAttribute("data-hooks", "Ada");
      await expect.element(name).toHaveAttribute("data-element", "mounted");
      const note = view.getByRole("textbox", { name: "Note" });
      await expect.element(note).toHaveAttribute("data-hooks", "Hello");
      await expect.element(note).toHaveAttribute("data-selectable", "true");
      await expect.element(note).toHaveAttribute("data-untrack", "mounted");
      await expect.element(note).toHaveAttribute("data-queue", "queued");
      await expect.element(view.getByText("Lovelace")).toHaveAttribute("data-hooks", "Lovelace");
      await expect.element(view.getByText("Al")).toHaveAttribute("data-hooks", "Al");
      await expect.element(view.getByText("Tidy")).toHaveAttribute("data-hooks", "TidyTrail");
    },
  );

  it(
    "updates a value a field writes, and a value a conditional narrows",
    { requires: ["directive"] },
    async () => {
      const view = await mountScenario(Profile, "initial");
      await view.user.fill(view.getByRole("textbox", { name: "Note" }), "Hi");
      await view.expectParity("typed");
      await expect
        .element(view.getByRole("textbox", { name: "Note" }))
        .toHaveAttribute("data-hooks", "updated Hi");
      await view.user.click(view.getByRole("button", { name: "Toggle" }));
      await view.expectParity("hidden");
      await expect.element(view.getByText("Ada")).not.toBeInTheDocument();
      await view.user.click(view.getByRole("button", { name: "Toggle" }));
      await view.expectParity("shown");
      await expect.element(view.getByText("Grace")).toHaveAttribute("data-hooks", "Grace");
      await view.user.click(view.getByRole("button", { name: "Count" }));
      await view.user.click(view.getByRole("button", { name: "Forget" }));
      await view.expectParity("cleared");
      await expect.element(view.getByText("Lovelace")).not.toBeInTheDocument();
      await expect.element(view.getByText("Al")).not.toBeInTheDocument();
    },
  );
});
