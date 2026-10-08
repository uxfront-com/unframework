// events/conditional-controls: `preventDefault()` runs exactly when the source runs it, even where
// that depends on more than the event. A `once` listener prevents the first key only, and only
// when it is Enter, so a message never starts with a blank line and every later Enter types one;
// a handler calls a helper that prevents Enter only while suggestions are open, so Enter accepts
// a suggestion then and types a line break otherwise. A target that runs controls apart from the
// handler, as the event is dispatched, cannot tell, and declares `conditional-event-control`
// unsupported: it has no output for the component, so its browser project skips every test
// (no output), and the tests that act require the capability.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import ReplyBox from "./ReplyBox.uf.tsx";

describeTargets("events/conditional-controls", () => {
  it("renders the empty message and answer", async () => {
    const view = await mountScenario(ReplyBox, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("textbox", { name: "Message" })).toBeVisible();
    await expect.element(view.getByText("Not started")).toBeVisible();
  });

  it(
    "prevents a first Enter in a once listener, and lets every later key through",
    { requires: ["interactivity", "event-once", "conditional-event-control"] },
    async () => {
      const view = await mountScenario(ReplyBox, "initial");
      await view.user.click(view.getByRole("textbox", { name: "Message" }));
      await view.user.keyboard("{Enter}");
      await view.expectParity("first-enter");
      await expect.element(view.getByText("Started", { exact: true })).toBeVisible();
      await expect.element(view.getByRole("textbox", { name: "Message" })).toHaveValue("");
      await view.user.keyboard("{Enter}hi");
      await view.expectParity("then-typed");
      await expect.element(view.getByRole("textbox", { name: "Message" })).toHaveValue("\nhi");
    },
  );

  it(
    "lets a first key through when it is not Enter",
    { requires: ["interactivity", "event-once", "conditional-event-control"] },
    async () => {
      const view = await mountScenario(ReplyBox, "initial");
      await view.user.click(view.getByRole("textbox", { name: "Message" }));
      await view.user.keyboard("a{Enter}");
      await view.expectParity("first-letter");
      await expect.element(view.getByText("Started", { exact: true })).toBeVisible();
      await expect.element(view.getByRole("textbox", { name: "Message" })).toHaveValue("a\n");
    },
  );

  it(
    "prevents Enter through a helper only while suggestions are open",
    { requires: ["interactivity", "conditional-event-control"] },
    async () => {
      const view = await mountScenario(ReplyBox, "initial");
      await view.user.type(view.getByRole("textbox", { name: "Answer" }), "ok");
      await view.user.keyboard("{Enter}");
      await view.expectParity("answer-typed");
      await expect.element(view.getByRole("textbox", { name: "Answer" })).toHaveValue("ok\n");
      await view.user.click(view.getByRole("button", { name: "Suggestions" }));
      await view.user.click(view.getByRole("textbox", { name: "Answer" }));
      await view.user.keyboard("{Enter}");
      await view.expectParity("suggestion-accepted");
      await expect.element(view.getByText("Accepted: 1")).toBeVisible();
      await expect.element(view.getByRole("textbox", { name: "Answer" })).toHaveValue("ok\n");
      await expect
        .element(view.getByRole("button", { name: "Suggestions" }))
        .toHaveAttribute("aria-pressed", "false");
    },
  );
});
