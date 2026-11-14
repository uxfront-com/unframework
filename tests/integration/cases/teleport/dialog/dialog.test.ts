// teleport/dialog: a confirmation dialog in a `<Teleport to="body">` that a condition around it
// opens and closes (ADR-0098). The dialog's own `onMounted` runs once its element is in the
// document, so it moves the focus into it. Escape and its buttons close it, and closing it
// leaves nothing in `body`, as the harness checks after every test.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Files from "./Files.uf.tsx";

describeTargets("teleport/dialog", () => {
  it("renders closed, with nothing teleported", async () => {
    const view = await mountScenario(Files, "closed");
    await view.expectParity("closed");
    await expect.element(view.getByRole("button", { name: "Delete notes.txt" })).toBeVisible();
    await expect.element(view.getByRole("dialog")).not.toBeInTheDocument();
  });

  it(
    "opens the dialog in body, with the focus on its first button",
    { requires: ["teleport", "interactivity"] },
    async () => {
      const view = await mountScenario(Files, "closed");
      await view.user.click(view.getByRole("button", { name: "Delete notes.txt" }));
      await view.expectParity("open");
      await expect.element(view.getByRole("dialog", { name: "Delete notes.txt?" })).toBeVisible();
      await expect.element(view.getByRole("button", { name: "Cancel" })).toHaveFocus();
      expect(document.body.lastElementChild?.classList.contains("backdrop")).toBe(true);
    },
  );

  it(
    "closes on Escape, and leaves nothing in body",
    { requires: ["teleport", "interactivity"] },
    async () => {
      const view = await mountScenario(Files, "closed");
      await view.user.click(view.getByRole("button", { name: "Delete notes.txt" }));
      await view.expectParity("open-for-escape");
      await view.user.keyboard("{Escape}");
      await view.expectParity("escaped");
      await expect.element(view.getByRole("button", { name: "Delete notes.txt" })).toBeVisible();
      await expect.element(view.getByRole("dialog")).not.toBeInTheDocument();
      expect(view.emitted("delete")).toEqual([]);
    },
  );

  it("closes on Cancel", { requires: ["teleport", "interactivity"] }, async () => {
    const view = await mountScenario(Files, "closed");
    await view.user.click(view.getByRole("button", { name: "Delete notes.txt" }));
    await view.expectParity("open-for-cancel");
    await view.user.click(view.getByRole("button", { name: "Cancel" }));
    await view.expectParity("cancelled");
    await expect.element(view.getByRole("button", { name: "Delete notes.txt" })).toBeVisible();
    await expect.element(view.getByRole("dialog")).not.toBeInTheDocument();
    expect(view.emitted("delete")).toEqual([]);
  });

  it(
    "closes on confirming, and emits the file it deletes",
    { requires: ["teleport", "interactivity"] },
    async () => {
      const view = await mountScenario(Files, "closed");
      await view.user.click(view.getByRole("button", { name: "Delete notes.txt" }));
      await view.expectParity("open-for-confirm");
      await view.user.click(view.getByRole("button", { name: "Delete", exact: true }));
      await view.expectParity("confirmed");
      await expect.element(view.getByText("notes.txt", { exact: true })).toBeVisible();
      await expect.element(view.getByRole("dialog")).not.toBeInTheDocument();
      expect(view.emitted("delete")).toEqual([["notes.txt"]]);
    },
  );
});
