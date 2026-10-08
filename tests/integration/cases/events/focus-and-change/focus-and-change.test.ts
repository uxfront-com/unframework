// events/focus-and-change: focus and change events keep the DOM's order and meaning on every
// target. A field's `focus` and `blur` run before its container's `focusin` and `focusout`; a
// focusable container's `focus` and `blur` are its own, never a child's, and their bodies are
// writes that count them, so a child's focus or blur that reached the container's listener
// (React's `onFocus` and `onBlur` follow `focusin` and `focusout`) shows; a checkbox fires
// `click`, then `input`, then `change`, and a click a listener prevented fires no `change`; a
// text field's `change` reaches a plain and a `once` listener of one element when the edit is
// committed, the `once` listener only the first time.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import ProfileFields from "./ProfileFields.uf.tsx";

describeTargets("events/focus-and-change", () => {
  it("renders the fields and an empty log", async () => {
    const view = await mountScenario(ProfileFields, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByText("Card not focused")).toBeVisible();
    await expect.element(view.getByText("Card blurs: 0")).toBeVisible();
    await expect.element(view.getByRole("checkbox", { name: "Public profile" })).toBeVisible();
  });

  it(
    "runs a field's focus and blur before its container's focusin and focusout",
    { requires: ["interactivity", "event-semantics"] },
    async () => {
      const view = await mountScenario(ProfileFields, "initial");
      await view.user.click(view.getByRole("textbox", { name: "Name" }));
      await view.expectParity("name-focused");
      await expect.element(view.getByRole("textbox", { name: "Name" })).toHaveFocus();
      await view.user.click(view.getByRole("button", { name: "Inside the card" }));
      await view.expectParity("name-left");
      const entries = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      expect(entries.elements().map((entry) => entry.textContent)).toEqual([
        "name focus",
        "group focusin",
        "name blur",
        "group focusout",
        "card button",
      ]);
      await expect.element(view.getByText("Card not focused")).toBeVisible();
    },
  );

  it(
    "follows a focusable container's own focus, not its child's",
    { requires: ["interactivity", "event-semantics"] },
    async () => {
      const view = await mountScenario(ProfileFields, "initial");
      await view.user.focus(view.getByRole("group", { name: "Card" }));
      await view.expectParity("card-focused");
      await expect.element(view.getByText("Card focused", { exact: true })).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Inside the card" }));
      await view.expectParity("card-child-focused");
      await expect.element(view.getByText("Card not focused")).toBeVisible();
      await expect.element(view.getByText("Card blurs: 1")).toBeVisible();
      await expect.element(view.getByRole("button", { name: "Inside the card" })).toHaveFocus();
      // The focus leaves the card's child for a field outside the card: the child's blur is not
      // the card's.
      await view.user.click(view.getByRole("textbox", { name: "Name" }));
      await view.expectParity("card-child-left");
      await expect.element(view.getByText("Card blurs: 1")).toBeVisible();
      await expect.element(view.getByText("Card not focused")).toBeVisible();
      await expect.element(view.getByRole("textbox", { name: "Name" })).toHaveFocus();
    },
  );

  it(
    "fires a checkbox's click, input and change in the DOM's order",
    { requires: ["interactivity", "event-semantics"] },
    async () => {
      const view = await mountScenario(ProfileFields, "initial");
      await view.user.click(view.getByRole("checkbox", { name: "Public profile" }));
      await view.expectParity("public-checked");
      const entries = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      expect(entries.elements().map((entry) => entry.textContent)).toEqual([
        "public click",
        "public input",
        "public change",
      ]);
      await expect.element(view.getByRole("checkbox", { name: "Public profile" })).toBeChecked();
    },
  );

  it(
    "fires no change for a click a listener prevented",
    { requires: ["interactivity", "event-semantics"] },
    async () => {
      const view = await mountScenario(ProfileFields, "initial");
      await view.user.click(view.getByRole("checkbox", { name: "Locked" }));
      await view.expectParity("locked-held");
      const entries = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      expect(entries.elements().map((entry) => entry.textContent)).toEqual(["locked click"]);
      await expect.element(view.getByRole("checkbox", { name: "Locked" })).not.toBeChecked();
      await expect.element(entries.nth(0)).toHaveTextContent("locked click");
    },
  );

  it(
    "commits a text field's change to a plain listener and, the first time, a once listener",
    { requires: ["interactivity", "event-semantics", "event-once"] },
    async () => {
      const view = await mountScenario(ProfileFields, "initial");
      await view.user.fill(view.getByRole("textbox", { name: "Nickname" }), "Ada");
      await view.user.tab();
      await view.expectParity("nickname-committed");
      await expect.element(view.getByText("Nickname: Ada")).toBeVisible();
      expect(view.emitted("firstNickname")).toEqual([["Ada"]]);
      await view.user.fill(view.getByRole("textbox", { name: "Nickname" }), "Grace");
      await view.user.tab();
      await view.expectParity("nickname-changed");
      await expect.element(view.getByText("Nickname: Grace")).toBeVisible();
      expect(view.emitted("firstNickname")).toEqual([["Ada"]]);
    },
  );
});
