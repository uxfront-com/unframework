// props/unread-props: a component that reads some of its props. The props it does not read (a
// required one, optional ones with and without defaults, booleans among them) are still declared,
// so a consumer may pass them, and they render nothing: no text, and no attribute on the root.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import ArticleTeaser from "./ArticleTeaser.uf.tsx";

// The whole text, whatever whitespace a target writes between the elements.
const TEXT = /^Compilers without a runtime ?One source, seven frameworks\. ?5 min read$/;

describeTargets("props/unread-props", () => {
  it("renders the props it reads when the unread optional ones are absent", async () => {
    const view = await mountScenario(ArticleTeaser, "unread-absent");
    await view.expectParity("unread-absent");
    await expect
      .element(view.getByRole("heading", { name: "Compilers without a runtime" }))
      .toBeVisible();
    const teaser = view.getByRole("article", { name: "Compilers without a runtime" });
    await expect.element(teaser).toMatchTextContent(TEXT);
    await expect.element(teaser).toHaveClass("article-teaser", { exact: true });
    await expect.element(teaser).not.toHaveAttribute("author");
  });

  it("renders the same when every unread prop is given", async () => {
    const view = await mountScenario(ArticleTeaser, "unread-given");
    await view.expectParity("unread-given");
    await expect
      .element(view.getByRole("heading", { name: "Compilers without a runtime" }))
      .toBeVisible();
    const teaser = view.getByRole("article", { name: "Compilers without a runtime" });
    await expect.element(teaser).toMatchTextContent(TEXT);
    await expect.element(teaser).toHaveClass("article-teaser", { exact: true });
    for (const name of ["author", "featured", "category", "pinned", "layout"]) {
      await expect.element(teaser).not.toHaveAttribute(name);
    }
  });
});
