// events/listener-pairs: a local function that client code hands to `addEventListener` is one
// function for the component's life, wherever it is added and removed. One handler adds a
// document key listener and another removes it (adding it twice adds it once); an Escape
// listener removes itself through the helper it calls, and a button's handler removes it through
// the same helper; `onMounted` adds a native click listener to a template ref, which it keeps in a
// setup `let` typed `HTMLButtonElement | null`, and `onUnmounted(() => stop())` removes every
// listener, so a key pressed once the component is gone reaches nothing of it. The events `save`
// and `status` are named like the function and the state that emit them.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import DraftPanel from "./DraftPanel.uf.tsx";

describeTargets("events/listener-pairs", () => {
  it("renders the closed panel", async () => {
    const view = await mountScenario(DraftPanel, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("Options closed, draft");
    await expect
      .element(view.getByRole("button", { name: "Options" }))
      .toHaveAttribute("aria-expanded", "false");
  });

  it(
    "removes the key listener that another button added",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(DraftPanel, "initial");
      await view.user.click(view.getByRole("button", { name: "Listen", exact: true }));
      await view.user.click(view.getByRole("button", { name: "Listen", exact: true }));
      await view.user.keyboard("a");
      await view.expectParity("listening");
      await expect
        .element(view.getByRole("list", { name: "Log" }).getByRole("listitem"))
        .toHaveTextContent("key a");
      expect(view.emitted("key")).toEqual([["a"]]);
      await view.user.click(view.getByRole("button", { name: "Stop listening" }));
      await view.user.keyboard("b");
      await view.expectParity("stopped-listening");
      await expect
        .element(view.getByRole("list", { name: "Log" }).getByRole("listitem"))
        .toHaveTextContent("key a");
      expect(view.emitted("key")).toEqual([["a"]]);
    },
  );

  it(
    "closes the options on Escape once, through the listener that removes itself",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(DraftPanel, "initial");
      await view.user.click(view.getByRole("button", { name: "Options" }));
      await view.expectParity("opened");
      await expect.element(view.getByRole("group", { name: "Draft options" })).toBeVisible();
      await view.user.keyboard("{Escape}");
      await view.expectParity("escaped");
      await expect.element(view.getByRole("status")).toHaveTextContent("Options closed, draft");
      expect(view.emitted("closed")).toEqual([["escape"]]);
      await view.user.keyboard("{Escape}");
      await view.expectParity("escaped-again");
      await expect.element(view.getByRole("status")).toHaveTextContent("Options closed, draft");
      expect(view.emitted("closed")).toEqual([["escape"]]);
    },
  );

  it(
    "closes the options from a button, which removes the Escape listener too",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(DraftPanel, "initial");
      await view.user.click(view.getByRole("button", { name: "Options" }));
      await view.expectParity("opened-for-close");
      await expect.element(view.getByRole("group", { name: "Draft options" })).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Close" }));
      await view.user.keyboard("{Escape}");
      await view.expectParity("closed-by-button");
      await expect.element(view.getByRole("status")).toHaveTextContent("Options closed, draft");
      expect(view.emitted("closed")).toEqual([["button"]]);
    },
  );

  it(
    "logs the handle's clicks through the listener added once mounted",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(DraftPanel, "initial");
      await view.user.click(view.getByRole("button", { name: "Handle" }));
      await view.expectParity("handle-clicked");
      await expect
        .element(view.getByRole("list", { name: "Log" }).getByRole("listitem"))
        .toHaveTextContent("handle");
    },
  );

  it("saves, and reports the status it changed", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(DraftPanel, "initial");
    await view.user.click(view.getByRole("button", { name: "Save" }));
    await view.user.click(view.getByRole("button", { name: "Save" }));
    await view.expectParity("saved");
    await expect.element(view.getByRole("status")).toHaveTextContent("Options closed, saved");
    expect(view.emitted("save")).toEqual([[1], [2]]);
    expect(view.emitted("status")).toEqual([["saved"]]);
  });

  it(
    "removes every listener when the component unmounts",
    { requires: ["interactivity"] },
    async () => {
      // The first view renders again before it unmounts, so the functions removed are the ones
      // added only if each keeps one identity across renders.
      const first = await mountScenario(DraftPanel, "initial");
      await first.user.click(first.getByRole("button", { name: "Listen", exact: true }));
      await first.user.click(first.getByRole("button", { name: "Options" }));
      await first.expectParity("first-armed");
      await expect
        .element(first.getByRole("button", { name: "Options" }))
        .toHaveAttribute("aria-expanded", "true");
      await first.unmount();
      const second = await mountScenario(DraftPanel, "initial");
      await second.user.click(second.getByRole("button", { name: "Listen", exact: true }));
      await second.user.keyboard("{Escape}");
      await second.expectParity("second-listening");
      await expect
        .element(second.getByRole("list", { name: "Log" }).getByRole("listitem"))
        .toHaveTextContent("key Escape");
      expect(second.emitted("key")).toEqual([["Escape"]]);
      expect(first.emitted("key")).toEqual([]);
      expect(first.emitted("closed")).toEqual([]);
    },
  );
});
