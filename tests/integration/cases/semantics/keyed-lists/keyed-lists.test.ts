// semantics/keyed-lists: a keyed item keeps its element while the list reorders and while the
// item is replaced by a copy (semantics contract, keyed lists; ADR-0096). Each rerender passes new
// objects, as a parent does after it fetches the list again, so a target that keyed a row by the
// item's reference would make a new row, and the input in it would lose its typed text and its
// focus. A browser blurs an element that is moved, and each framework picks which rows it moves,
// so the focus is asserted where the focused row keeps its place and the rows around it move.
import { describeTargets, it, mount, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Checklist, { type Entry } from "./Checklist.uf.tsx";

const milk: Entry = { id: "milk", label: "Milk" };
const bread: Entry = { id: "bread", label: "Bread" };
const eggs: Entry = { id: "eggs", label: "Eggs" };

/** Copies, as a parent that fetched the list again would pass. */
function copies(...entries: Entry[]): Entry[] {
  return entries.map((entry) => ({ ...entry }));
}

describeTargets("semantics/keyed-lists", () => {
  it("renders a row for each entry, in order", async () => {
    const view = await mountScenario(Checklist, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("listitem").first()).toHaveTextContent("Milk");
    await expect.element(view.getByRole("textbox", { name: "Note for Eggs" })).toBeVisible();
  });

  // Browser-only: a rerender has no server twin.
  it(
    "keeps the focus and the typed text while the rows around it reorder",
    { requires: ["keyed-identity"] },
    async () => {
      const view = await mount(Checklist, { props: { entries: [milk, bread, eggs] } });
      await view.user.type(view.getByRole("textbox", { name: "Note for Milk" }), "oat");
      await view.rerender({ entries: copies(milk, eggs, bread) });
      await view.expectParity("reordered");
      const note = view.getByRole("textbox", { name: "Note for Milk" });
      await expect.element(note).toHaveFocus();
      await expect.element(note).toHaveValue("oat");
      await expect.element(view.getByRole("listitem").nth(1)).toHaveTextContent("Eggs");
    },
  );

  it(
    "keeps the focus and the typed text when the entry is renamed and others come and go",
    { requires: ["keyed-identity"] },
    async () => {
      const view = await mount(Checklist, { props: { entries: [milk, bread, eggs] } });
      await view.user.type(view.getByRole("textbox", { name: "Note for Bread" }), "wholemeal");
      await view.rerender({
        entries: [
          ...copies(milk),
          { id: "bread", label: "Rye bread" },
          { id: "tea", label: "Tea" },
        ],
      });
      await view.expectParity("renamed");
      const note = view.getByRole("textbox", { name: "Note for Rye bread" });
      await expect.element(note).toHaveFocus();
      await expect.element(note).toHaveValue("wholemeal");
      await expect.element(view.getByRole("listitem").nth(2)).toHaveTextContent("Tea");
    },
  );

  it(
    "keeps each row's typed text when the rows move",
    { requires: ["keyed-identity"] },
    async () => {
      const view = await mount(Checklist, { props: { entries: [milk, bread, eggs] } });
      await view.user.type(view.getByRole("textbox", { name: "Note for Milk" }), "oat");
      await view.user.type(view.getByRole("textbox", { name: "Note for Eggs" }), "free range");
      await view.rerender({ entries: copies(bread, milk, eggs) });
      await view.expectParity("moved");
      await expect.element(view.getByRole("textbox", { name: "Note for Milk" })).toHaveValue("oat");
      await expect
        .element(view.getByRole("textbox", { name: "Note for Eggs" }))
        .toHaveValue("free range");
      await expect.element(view.getByRole("textbox", { name: "Note for Bread" })).toHaveValue("");
      await expect.element(view.getByRole("listitem").first()).toHaveTextContent("Bread");
    },
  );
});
