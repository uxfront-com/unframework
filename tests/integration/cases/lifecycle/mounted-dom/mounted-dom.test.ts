// lifecycle/mounted-dom: `onMounted` runs once the component's DOM is in the document: it reads an
// element through a template ref (its text, which does not depend on layout), writes state and
// emits. It runs once, so a rerender does not count again. The server render (L6,
// ssr.article.html) shows the state before the hook; the first browser capture depends on client
// code, so it needs `interactivity` (case.json's `requires` note).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import ArticlePreview from "./ArticlePreview.uf.tsx";

describeTargets("lifecycle/mounted-dom", () => {
  it("reads the mounted DOM, writes state and emits", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(ArticlePreview, "article");
    await view.expectParity("mounted");
    await expect.element(view.getByRole("status")).toHaveTextContent("57 characters");
    expect(view.emitted("ready")).toEqual([[57]]);
  });

  // Browser-only: a rerender has no server twin.
  it("does not run again on a rerender", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(ArticlePreview, "article");
    await view.rerender({ title: "Release notes", text: "Short." });
    await view.expectParity("after-rerender");
    await expect.element(view.getByText("Short.")).toBeVisible();
    await expect.element(view.getByRole("status")).toHaveTextContent("57 characters");
    expect(view.emitted("ready")).toEqual([[57]]);
  });
});
