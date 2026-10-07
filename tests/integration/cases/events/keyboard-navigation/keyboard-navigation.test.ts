// events/keyboard-navigation: the WAI-ARIA keyboard handlers as they are written everywhere. A
// combobox's `switch (event.key)` prevents each key it handles, as the first statement of its
// case: the arrow keys move the active city and leave the caret where it was, Enter chooses, and
// Escape closes the list without clearing the search field. A note's `if` block prevents Enter
// beside the statements that add the note, so Shift+Enter still breaks the line. An option's
// `mousedown` listener that only prevents keeps the field focused while a click chooses, and a
// form whose `submit` listener only prevents stays on the page. Qwik lifts only a control at the
// top of a listener or alone under an `if` there, so the tests of the `switch` and the `if`
// block require `conditional-event-control`; events/control-only-listeners pins the bare
// controls where Qwik runs them.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import CityPicker from "./CityPicker.uf.tsx";

describeTargets("events/keyboard-navigation", () => {
  it("renders the closed picker", async () => {
    const view = await mountScenario(CityPicker, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("combobox", { name: "City" })).toBeVisible();
    await expect.element(view.getByRole("status")).toHaveTextContent("No city chosen");
  });

  it(
    "moves through the cities with the arrow keys, keeping the caret",
    { requires: ["interactivity", "conditional-event-control"] },
    async () => {
      const view = await mountScenario(CityPicker, "initial");
      const city = view.getByRole("combobox", { name: "City" });
      await view.user.type(city, "Bn{ArrowLeft}{ArrowDown}{ArrowUp}er");
      await view.expectParity("typed");
      await expect.element(city).toHaveValue("Bern");
      await expect.element(view.getByRole("option", { name: "Bern" })).toBeVisible();
      await view.user.keyboard("{ArrowDown}{Enter}");
      await view.expectParity("chosen-by-key");
      await expect.element(view.getByRole("status")).toHaveTextContent("Chosen: Bern");
      expect(view.emitted("chose")).toEqual([["Bern"]]);
      await view.user.keyboard("{Escape}");
      await view.expectParity("escaped");
      await expect.element(city).toHaveValue("Bern");
      await expect.element(view.getByRole("status")).toHaveTextContent("Chosen: Bern");
    },
  );

  it(
    "closes the list on Escape and keeps the text",
    { requires: ["interactivity", "conditional-event-control"] },
    async () => {
      const view = await mountScenario(CityPicker, "initial");
      const city = view.getByRole("combobox", { name: "City" });
      await view.user.type(city, "Ber{ArrowDown}");
      await view.expectParity("opened");
      await expect
        .element(view.getByRole("option", { name: "Bern" }))
        .toHaveAttribute("aria-selected", "true");
      await view.user.keyboard("{Escape}");
      await view.expectParity("closed");
      await expect.element(city).toHaveValue("Ber");
      await expect.element(city).toHaveAttribute("aria-expanded", "false");
      expect(view.getByRole("option").elements()).toEqual([]);
    },
  );

  it(
    "chooses a city with the mouse, keeping the field focused",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(CityPicker, "initial");
      const city = view.getByRole("combobox", { name: "City" });
      await view.user.type(city, "Ba");
      await view.expectParity("listed");
      await expect.element(view.getByRole("option", { name: "Basel" })).toBeVisible();
      await view.user.click(view.getByRole("option", { name: "Basel" }));
      await view.expectParity("chosen-by-mouse");
      await expect.element(view.getByRole("status")).toHaveTextContent("Chosen: Basel");
      await expect.element(city).toHaveFocus();
      expect(view.emitted("chose")).toEqual([["Basel"]]);
    },
  );

  it("keeps the search form on the page", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(CityPicker, "initial");
    await view.user.click(view.getByRole("button", { name: "Search" }));
    await view.expectParity("searched");
    await expect.element(view.getByRole("combobox", { name: "City" })).toBeVisible();
    await expect.element(view.getByRole("status")).toHaveTextContent("No city chosen");
  });

  it(
    "adds a note on Enter, and breaks the line on Shift+Enter",
    { requires: ["interactivity", "conditional-event-control"] },
    async () => {
      const view = await mountScenario(CityPicker, "initial");
      const note = view.getByRole("textbox", { name: "Note" });
      await view.user.type(note, "Pack light{Enter}");
      await view.expectParity("noted");
      await expect
        .element(view.getByRole("list", { name: "Notes" }).getByRole("listitem"))
        .toHaveTextContent("Pack light");
      await expect.element(note).toHaveValue("");
      expect(view.emitted("noted")).toEqual([["Pack light"]]);
      await view.user.keyboard("Gate{Shift>}{Enter}{/Shift}B4");
      await view.expectParity("line-broken");
      await expect.element(note).toHaveValue("Gate\nB4");
      expect(view.emitted("noted")).toEqual([["Pack light"]]);
    },
  );
});
