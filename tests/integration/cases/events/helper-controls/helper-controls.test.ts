// events/helper-controls: `preventDefault()` acts exactly where the source calls it, through a
// helper and beside other listeners. Escape clears the search through a helper that prevents the
// key, so every other key still types; a helper that returns `false` from a key handler, inline
// or in a list, prevents nothing (a handler's value is discarded); a state read only in a list
// handler's arguments reaches the emit; a form with a `once` and a plain submit listener, both
// preventing, is never submitted.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import QuickActions from "./QuickActions.uf.tsx";

describeTargets("events/helper-controls", () => {
  it("renders the fields and the actions", async () => {
    const view = await mountScenario(QuickActions, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("button", { name: "Run Paste" })).toBeVisible();
    await expect.element(view.getByText("Subscriptions: 0")).toBeVisible();
  });

  it(
    "clears the search on Escape through a helper, and lets every other key type",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(QuickActions, "initial");
      await view.user.type(view.getByRole("textbox", { name: "Search" }), "abc");
      await view.expectParity("query-typed");
      await expect.element(view.getByRole("textbox", { name: "Search" })).toHaveValue("abc");
      await expect.element(view.getByText("Query: abc")).toBeVisible();
      await view.user.keyboard("{Escape}");
      await view.expectParity("query-cleared");
      await expect.element(view.getByText("Query:", { exact: true })).toBeVisible();
    },
  );

  it(
    "lets a key through when the helper its handler calls returns false",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(QuickActions, "initial");
      await view.user.type(view.getByRole("textbox", { name: "Note" }), "ok");
      await view.expectParity("note-typed");
      await expect.element(view.getByRole("textbox", { name: "Note" })).toHaveValue("ok");
      await expect.element(view.getByText("Last key: k")).toBeVisible();
      await view.user.type(view.getByRole("textbox", { name: "Shortcut for Paste" }), "z");
      await view.expectParity("shortcut-typed");
      await expect
        .element(view.getByRole("textbox", { name: "Shortcut for Paste" }))
        .toHaveValue("z");
      await expect.element(view.getByText("Last key: Paste: z")).toBeVisible();
    },
  );

  it(
    "passes a state read only in a list handler's arguments",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(QuickActions, "initial");
      await view.user.selectOptions(view.getByRole("combobox", { name: "Scope" }), "team");
      await view.user.click(view.getByRole("button", { name: "Run Copy" }));
      await view.expectParity("chosen");
      await expect.element(view.getByRole("combobox", { name: "Scope" })).toHaveValue("team");
      expect(view.emitted("chosen")).toEqual([["Copy", "team"]]);
    },
  );

  it(
    "prevents every submission, and welcomes only the first",
    { requires: ["interactivity", "event-once"] },
    async () => {
      const view = await mountScenario(QuickActions, "initial");
      await view.user.click(view.getByRole("button", { name: "Subscribe" }));
      await view.user.click(view.getByRole("button", { name: "Subscribe" }));
      await view.expectParity("subscribed-twice");
      await expect.element(view.getByText("Subscriptions: 2")).toBeVisible();
      expect(view.emitted("welcomed")).toEqual([[]]);
      expect(view.emitted("subscribed")).toEqual([[1], [2]]);
    },
  );
});
