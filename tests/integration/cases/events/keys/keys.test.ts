// events/keys: a keyboard handler on a text field: ArrowDown and ArrowUp move the current
// command, Enter runs it (and is prevented, so the search form, with one field and no button, is
// not submitted), Escape resets. A second field's handler is an expression-bodied `&&` arrow,
// whose `false` must not prevent the key (Angular prevents a listener's `false`): typing in both
// fields still works, and Escape clears the second field through a template ref.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import CommandMenu from "./CommandMenu.uf.tsx";

describeTargets("events/keys", () => {
  it("renders the commands with the first one current", async () => {
    const view = await mountScenario(CommandMenu, "commands");
    await view.expectParity("commands");
    await expect.element(view.getByRole("listitem").nth(0)).toHaveAttribute("aria-current", "true");
    await expect.element(view.getByLabelText("Command", { exact: true })).toBeVisible();
  });

  it(
    "moves through the commands with the arrow keys and runs one with Enter",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(CommandMenu, "commands");
      await view.user.click(view.getByLabelText("Command", { exact: true }));
      await view.user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowUp}");
      await view.user.keyboard("{Enter}");
      await view.expectParity("ran-command");
      await expect
        .element(view.getByRole("listitem").nth(2))
        .toHaveAttribute("aria-current", "true");
      expect(view.emitted("run")).toEqual([["Open the logs"]]);
    },
  );

  it("resets the current command with Escape", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(CommandMenu, "commands");
    await view.user.click(view.getByLabelText("Command", { exact: true }));
    await view.user.keyboard("{ArrowDown}");
    await view.user.keyboard("{Escape}");
    await view.expectParity("dismissed");
    await expect.element(view.getByRole("listitem").nth(0)).toHaveAttribute("aria-current", "true");
    expect(view.emitted("dismiss")).toEqual([[]]);
  });

  it(
    "keeps typing working beside an expression-bodied && handler",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(CommandMenu, "commands");
      await view.user.type(view.getByLabelText("Command", { exact: true }), "logs");
      await view.user.type(view.getByLabelText("Shortcut name"), "deploy-prod");
      await view.expectParity("shortcut-typed");
      await expect.element(view.getByLabelText("Shortcut name")).toHaveValue("deploy-prod");
      await view.user.keyboard("{Escape}");
      await view.expectParity("typed");
      await expect.element(view.getByLabelText("Command", { exact: true })).toHaveValue("logs");
      await expect.element(view.getByLabelText("Shortcut name")).toHaveValue("");
    },
  );
});
