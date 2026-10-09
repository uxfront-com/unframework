// dynamic/tags: `<component is={nested.value ? "h3" : "h2"}>` renders one of two tags (ADR-0054),
// with the class and the text on whichever it renders, and switches when the condition does.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Section from "./Section.uf.tsx";

describeTargets("dynamic/tags", () => {
  it("renders the first tag", async () => {
    const view = await mountScenario(Section, "intro");
    await view.expectParity("intro");
    await expect
      .element(view.getByRole("heading", { level: 2, name: "Introduction" }))
      .toHaveClass("title");
  });

  it("switches the tag", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Section, "intro");
    await view.user.click(view.getByRole("button", { name: "Nest" }));
    await view.expectParity("nested");
    await expect
      .element(view.getByRole("heading", { level: 3, name: "Introduction" }))
      .toHaveClass("title");
  });
});
