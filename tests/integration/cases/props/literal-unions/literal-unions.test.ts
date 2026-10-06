// props/literal-unions: string and number literal unions mapped to class names and to text,
// with literal defaults.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import StatusPill from "./StatusPill.uf.tsx";

describeTargets("props/literal-unions", () => {
  it("maps the given member and the defaults to classes and text", async () => {
    const view = await mountScenario(StatusPill, "active");
    await view.expectParity("active");
    await expect
      .element(view.getByText("Active"))
      .toHaveClass("pill pill-active pill-small pill-level-1", { exact: true });
  });

  it("maps other members, overriding the defaults", async () => {
    const view = await mountScenario(StatusPill, "paused-large");
    await view.expectParity("paused-large");
    await expect
      .element(view.getByText("Paused"))
      .toHaveClass("pill pill-paused pill-large pill-level-2", { exact: true });
  });

  it("renders the last member of each union", async () => {
    const view = await mountScenario(StatusPill, "archived-critical");
    await view.expectParity("archived-critical");
    await expect
      .element(view.getByText("Archived (critical)"))
      .toHaveClass("pill pill-archived pill-small pill-level-3", { exact: true });
  });
});
