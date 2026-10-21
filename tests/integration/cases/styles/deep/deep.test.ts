// styles/deep: `:deep()` (ADR-0063). The article's `.article :deep(.note)` rule keeps the scope
// attribute on `.article` and reaches the note inside its unstyled child; its scoped `.note`
// rule does not.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Article from "./Article.uf.tsx";

describeTargets("styles/deep", () => {
  it("styles the child's note through the deep rule alone", async () => {
    const view = await mountScenario(Article, "release");
    await view.expectParity("release");
    await expect.element(view.getByRole("heading", { name: "Release notes" })).toBeVisible();
    await expect.element(view.getByText("Styles arrive in M4.")).toBeVisible();
  });
});
