// hydration/use-id: the ids `useId()` makes in two instances of one child tie each label to its
// field and each field to its hint. A server render and the client that hydrates it make the same
// ids, which the hydrate projects compare raw (L12's `ids`), since the DOM check renames them.
// The second test renders again, after every id the first one counted on each side.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Signup from "./Signup.uf.tsx";

describeTargets("hydration/use-id", () => {
  it("labels and describes each field through its own ids", async () => {
    const view = await mountScenario(Signup, "default");
    await view.expectParity("default");
    await expect
      .element(view.getByRole("textbox", { name: "Name" }))
      .toHaveAccessibleDescription("As it appears on your card.");
    await expect
      .element(view.getByRole("textbox", { name: "Email" }))
      .toHaveAccessibleDescription("We send the receipt here.");
  });

  it("keeps the server's ids in a later render", async () => {
    const view = await mountScenario(Signup, "again");
    await view.expectParity("again");
    await expect
      .element(view.getByRole("textbox", { name: "Email" }))
      .toHaveAccessibleDescription("We send the receipt here.");
  });
});
