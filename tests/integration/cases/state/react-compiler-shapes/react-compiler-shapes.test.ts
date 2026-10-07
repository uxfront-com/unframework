// state/react-compiler-shapes: everyday code that the React Compiler bails out on, which React's
// output marks "use no memo" so that the component still compiles, and which behaves the same on
// every target. A patch's missing keys default to the current settings through destructuring
// defaults; a nested arrow's parameter default reads the current limit when it is called; a save
// awaits a reply in a `try` block that throws on an error and reads `??`, `?:` and an emit, and its
// `finally` clause ends the save whichever way it went.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import DisplaySettings from "./DisplaySettings.uf.tsx";

describeTargets("state/react-compiler-shapes", () => {
  it("renders the default settings", async () => {
    const view = await mountScenario(DisplaySettings, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("Theme light, size 14");
    await expect.element(view.getByText("Never saved")).toBeVisible();
  });

  it(
    "applies a patch whose missing keys keep the current values",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(DisplaySettings, "initial");
      await view.user.click(view.getByRole("button", { name: "Dark" }));
      await view.user.click(view.getByRole("button", { name: "Larger" }));
      await view.expectParity("dark-and-larger");
      await expect.element(view.getByRole("status")).toHaveTextContent("Theme dark, size 18");
      expect(view.emitted("applied")).toEqual([
        ["dark", 14],
        ["dark", 18],
      ]);
      await view.user.click(view.getByRole("button", { name: "Larger" }));
      await view.user.click(view.getByRole("button", { name: "Larger" }));
      await view.expectParity("at-the-limit");
      await expect.element(view.getByRole("status")).toHaveTextContent("Theme dark, size 20");
      await view.user.click(view.getByRole("button", { name: "Allow up to 30" }));
      await view.user.click(view.getByRole("button", { name: "Larger" }));
      await view.expectParity("past-the-old-limit");
      await expect.element(view.getByRole("status")).toHaveTextContent("Theme dark, size 24");
      expect(view.emitted("applied")).toEqual([
        ["dark", 14],
        ["dark", 18],
        ["dark", 20],
        ["dark", 20],
        ["dark", 24],
      ]);
    },
  );

  it("saves with an id, then as a draft", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(DisplaySettings, "initial");
    await view.user.click(view.getByRole("button", { name: "Save" }));
    await view.expectParity("saving");
    await expect.element(view.getByText("Saving")).toBeVisible();
    await view.user.click(view.getByRole("button", { name: "Reply with an id" }));
    await view.expectParity("saved-with-id");
    await expect.element(view.getByText("Saved as #7")).toBeVisible();
    expect(view.emitted("saved")).toEqual([[7]]);
    await view.user.click(view.getByRole("button", { name: "Save" }));
    await view.user.click(view.getByRole("button", { name: "Reply as a draft" }));
    await view.expectParity("saved-as-draft");
    await expect.element(view.getByText("Saved as a draft")).toBeVisible();
    expect(view.emitted("saved")).toEqual([[7], [0]]);
  });

  it(
    "reports the error the try block throws, and ends the save",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(DisplaySettings, "initial");
      await view.user.click(view.getByRole("button", { name: "Save" }));
      await view.user.click(view.getByRole("button", { name: "Reply with an error" }));
      await view.expectParity("failed");
      await expect.element(view.getByText("Failed: Disk full")).toBeVisible();
      expect(view.emitted("saved")).toEqual([]);
    },
  );
});
