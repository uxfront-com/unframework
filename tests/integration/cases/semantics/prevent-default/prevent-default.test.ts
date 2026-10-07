// semantics/prevent-default: `preventDefault()` runs synchronously while the browser dispatches
// the event, on every target (Qwik's handlers load lazily, so its output prevents in the
// dispatch): a key under a condition on the event alone, a form's submission (by its button and
// by Enter), and a link's navigation. The harness fails a test whose submission or navigation is
// not prevented (semantics contract, prevent default).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import TagForm from "./TagForm.uf.tsx";

describeTargets("semantics/prevent-default", () => {
  it("renders the empty form", async () => {
    const view = await mountScenario(TagForm, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByLabelText("New tag")).toHaveValue("");
    await expect.element(view.getByRole("button", { name: "Add tag" })).toBeVisible();
  });

  it(
    "keeps commas out of the field and adds tags without submitting the form",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(TagForm, "initial");
      await view.user.type(view.getByLabelText("New tag"), "design,systems");
      // Compared before the submission: one that is not prevented fails the next settle, which
      // must not abort the test before L9 compares this step.
      await view.expectParity("comma-kept-out");
      await view.user.click(view.getByRole("button", { name: "Add tag" }));
      await view.user.type(view.getByLabelText("New tag"), "ui");
      await view.user.keyboard("{Enter}");
      await view.expectParity("tags-added");
      await expect.element(view.getByRole("listitem").nth(0)).toHaveTextContent("designsystems");
      await expect.element(view.getByRole("listitem").nth(1)).toHaveTextContent("ui");
      await expect.element(view.getByLabelText("New tag")).toHaveValue("");
      expect(view.emitted("tagsChange")).toEqual([[["designsystems"]], [["designsystems", "ui"]]]);
    },
  );

  it("opens the help without following the link", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(TagForm, "initial");
    await view.user.click(view.getByRole("link", { name: "How tags work" }));
    await view.expectParity("help-open");
    await expect
      .element(view.getByText("A tag is one word: commas are not allowed."))
      .toBeVisible();
  });
});
