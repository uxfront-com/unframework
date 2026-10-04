// jsx/fragments: a component whose root is a fragment of several elements, fragments as the
// branches of a conditional, and a fragment inside an element, flattened into it.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import ArticleHeader from "./ArticleHeader.uf.tsx";

describeTargets("jsx/fragments", () => {
  it("renders every root, and the first branch's fragment", async () => {
    const view = await mountScenario(ArticleHeader, "draft");
    await view.expectParity("draft");
    await expect.element(view.getByRole("heading", { name: "Release notes" })).toBeVisible();
    await expect.element(view.getByText("What changed in 2.0")).toBeVisible();
    await expect.element(view.getByText("Draft")).toBeVisible();
    await expect.element(view.getByText("Only editors can see this article.")).toBeVisible();
    await expect.element(view.getByText("Tagged release, changelog")).toBeVisible();
  });

  it("renders the other branch's fragment, without the optional root", async () => {
    const view = await mountScenario(ArticleHeader, "published");
    await view.expectParity("published");
    await expect.element(view.getByRole("heading", { name: "Migration guide" })).toBeVisible();
    await expect.element(view.getByText("Published")).toBeVisible();
    await expect.element(view.getByText("Everyone can read this article.")).toBeVisible();
    await expect.element(view.getByText("Tagged guides")).toBeVisible();
  });
});
