// props/unread-props-object: a placeholder that takes the article's props, so a page can render
// it in the article's place, and reads none of them. The props object is still declared, so a
// consumer may pass every prop, and none renders: no text, and no attribute on the root.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import ArticleSkeleton from "./ArticleSkeleton.uf.tsx";

describeTargets("props/unread-props-object", () => {
  it("renders the placeholder when only the required prop is given", async () => {
    const view = await mountScenario(ArticleSkeleton, "required-only");
    await view.expectParity("required-only");
    const skeleton = view.getByRole("article", { name: "Loading article" });
    await expect.element(skeleton).toHaveTextContent("Loading the article");
    await expect.element(skeleton).toHaveAttribute("aria-busy", "true");
    await expect.element(skeleton).not.toHaveAttribute("title");
  });

  it("renders the same placeholder when every prop is given", async () => {
    const view = await mountScenario(ArticleSkeleton, "props-given");
    await view.expectParity("props-given");
    const skeleton = view.getByRole("article", { name: "Loading article" });
    await expect.element(skeleton).toHaveTextContent("Loading the article");
    await expect.element(skeleton).toHaveAttribute("aria-busy", "true");
    for (const name of ["title", "summary", "minutes"]) {
      await expect.element(skeleton).not.toHaveAttribute(name);
    }
  });
});
