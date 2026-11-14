// jsx/raw-html: `innerHTML` renders markup as HTML on every target (ADR-0097). A prop's markup
// keeps its `id`, `data-*` and `style` attributes, which Angular's sanitiser would strip, and a
// static string renders as markup too. An empty string renders an empty element.
import { describeTargets, mountScenario } from "@unframework.dev/testing";
import { expect, it } from "vitest";

import Article from "./Article.uf.tsx";

describeTargets("jsx/raw-html", () => {
  it("renders a prop's markup and a static string as HTML", async () => {
    const view = await mountScenario(Article, "default");
    await view.expectParity("default");
    const lead = view.getByRole("paragraph");
    await expect.element(lead).toHaveTextContent("Version 2 is out.");
    await expect.element(lead).toHaveAttribute("id", "lead");
    await expect.element(lead).toHaveAttribute("data-kind", "intro");
    await expect.element(lead).toHaveStyle({ color: "rgb(0, 0, 128)" });
    await expect.element(view.getByText("out", { exact: true })).toBeVisible();
    await expect.element(view.getByRole("listitem").nth(1)).toHaveTextContent("Fewer warnings");
    await expect.element(view.getByText("News", { exact: true })).toBeVisible();
  });

  it("renders an empty element for an empty string", async () => {
    const view = await mountScenario(Article, "empty");
    await view.expectParity("empty");
    await expect.element(view.getByRole("heading", { name: "Draft" })).toBeVisible();
    await expect.element(view.getByRole("listitem")).not.toBeInTheDocument();
  });
});
