// state/object-replacement: an object ref is replaced whole with a spread copy (ADR-0008), so a
// write of one field keeps the others; several fields render from it.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import ProfileCard from "./ProfileCard.uf.tsx";

describeTargets("state/object-replacement", () => {
  it("renders every field of the object", async () => {
    const view = await mountScenario(ProfileCard, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();
    await expect.element(view.getByText("Analyst")).toBeVisible();
    await expect.element(view.getByRole("status")).toHaveTextContent("Away");
  });

  it(
    "replaces the object with a new name and keeps the other fields",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(ProfileCard, "initial");
      await view.user.click(view.getByRole("button", { name: "Use married name" }));
      await view.expectParity("renamed");
      await expect.element(view.getByRole("heading", { name: "Ada King" })).toBeVisible();
      await expect.element(view.getByText("Analyst")).toBeVisible();
      await expect.element(view.getByRole("status")).toHaveTextContent("Away");
    },
  );

  it(
    "replaces the object twice, each copy from the latest",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(ProfileCard, "initial");
      await view.user.click(view.getByRole("button", { name: "Use married name" }));
      await view.user.click(view.getByRole("button", { name: "Available" }));
      await view.expectParity("renamed-and-available");
      await expect.element(view.getByRole("heading", { name: "Ada King" })).toBeVisible();
      await expect.element(view.getByRole("status")).toHaveTextContent("Available");
      await expect
        .element(view.getByRole("button", { name: "Available" }))
        .toHaveAttribute("aria-pressed", "true");
    },
  );
});
