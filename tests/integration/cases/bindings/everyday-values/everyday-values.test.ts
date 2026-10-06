// bindings/everyday-values: values authors write every day render as written: a style object of
// zero lengths, which resets the quote's default margins, and `dir="auto"` on user text.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import CommentQuote from "./CommentQuote.uf.tsx";

describeTargets("bindings/everyday-values", () => {
  it("renders the zero lengths and the text direction", async () => {
    const view = await mountScenario(CommentQuote, "comment");
    await view.expectParity("comment");
    await expect
      .element(view.getByText("It's easier to ask forgiveness than it is to get permission."))
      .toHaveAttribute("dir", "auto");
    await expect
      .element(view.getByRole("blockquote"))
      .toHaveStyle("margin-top: 0px; margin-left: 0px; padding-top: 0px; padding-left: 0px");
    await expect.element(view.getByText("Grace Hopper")).toBeVisible();
  });
});
