// events/emit-payloads: events declared with named tuples: no payload, one value, two values, an
// object of a local type, and an optional member, given and left out. `view.events()` keeps the
// order of the emits; the two of one handler (`archive`) arrive in the order it made them.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import FileRow from "./FileRow.uf.tsx";

describeTargets("events/emit-payloads", () => {
  it("renders the file row", async () => {
    const view = await mountScenario(FileRow, "readme");
    await view.expectParity("readme");
    await expect.element(view.getByRole("group", { name: "docs/readme.md" })).toBeVisible();
    await expect.element(view.getByText("docs/readme.md (2048 bytes)")).toBeVisible();
  });

  it("emits every payload shape, in order", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(FileRow, "readme");
    await view.user.click(view.getByRole("button", { name: "Refresh" }));
    await view.user.click(view.getByRole("button", { name: "Open" }));
    await view.user.click(view.getByRole("button", { name: "Archive" }));
    await view.user.click(view.getByRole("button", { name: "Select" }));
    await view.user.click(view.getByRole("button", { name: "Share", exact: true }));
    await view.user.click(view.getByRole("button", { name: "Share with a note" }));
    await view.expectParity("all-events");
    await expect.element(view.getByText("docs/readme.md (2048 bytes)")).toBeVisible();
    expect(view.emitted("refresh")).toEqual([[], []]);
    expect(view.emitted("share")).toEqual([
      ["docs/readme.md"],
      ["docs/readme.md", "Please review"],
    ]);
    expect(view.events()).toEqual([
      ["refresh"],
      ["open", "docs/readme.md"],
      ["move", "docs/readme.md", "archive/docs/readme.md"],
      ["refresh"],
      ["pick", { path: "docs/readme.md", size: 2048 }],
      ["share", "docs/readme.md"],
      ["share", "docs/readme.md", "Please review"],
    ]);
  });
});
