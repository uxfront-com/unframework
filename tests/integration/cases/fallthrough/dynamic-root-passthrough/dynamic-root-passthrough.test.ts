// fallthrough/dynamic-root-passthrough: a component whose root is a `<component is>` over tags
// takes a consumer's `id`, ARIA and `data-*` attributes, `title`, listeners and ref, directly or
// through a component whose root it is, on whichever tag renders (ADR-0122). The consumer's
// `title` wins over the root's own. Each listener logs its event's `currentTarget`, the element
// it is attached to, and each ref focuses the element that renders, before and after the tag
// changes.
import { describeTargets, it, mount } from "@unframework.dev/testing";
import type { View } from "@unframework.dev/testing";
import { expect } from "vitest";

import Page from "./Page.uf.tsx";

/** The attributes a consumer passes reach the element that renders, whichever tag it is. */
async function expectAttributes(view: View, role: "link" | "button") {
  const direct = view.getByRole(role, { name: "Direct" });
  await expect.element(direct).toHaveAttribute("id", "direct");
  await expect.element(direct).toHaveAttribute("data-testid", "direct");
  await expect.element(direct).toHaveAttribute("title", "Go");
  await expect.element(direct).toHaveClass("base");
  const chained = view.getByRole(role, { name: "Chained" });
  await expect.element(chained).toHaveAttribute("id", "chained");
  await expect.element(chained).toHaveAttribute("data-testid", "chained");
  await expect.element(chained).toHaveAttribute("title", "Base");
  await expect.element(chained).toHaveClass("base", "primary");
}

/** The log's entries, in order. */
function entries(view: View): (string | null)[] {
  const items = view.getByRole("list", { name: "Log" }).getByRole("listitem");
  return items.elements().map((entry) => entry.textContent);
}

describeTargets("fallthrough/dynamic-root-passthrough", () => {
  it("puts the attributes on the link", async () => {
    const view = await mount(Page);
    await view.expectParity("initial");
    await expectAttributes(view, "link");
    await expect.element(view.getByRole("link", { name: "Direct" })).toHaveAttribute("href", "#direct");
  });

  it("moves the attributes as the tag changes", { requires: ["interactivity"] }, async () => {
    const view = await mount(Page);
    await view.user.click(view.getByRole("button", { name: "Toggle" }));
    await view.expectParity("toggled");
    await expectAttributes(view, "button");
    await expect.element(view.getByRole("button", { name: "Direct" })).not.toHaveAttribute("href");
    await expect.element(view.getByRole("link", { name: "Direct" })).not.toBeInTheDocument();
  });

  it(
    "fires the consumer's listeners from whichever tag renders",
    { requires: ["interactivity", "event-semantics"] },
    async () => {
      const view = await mount(Page);
      await view.user.tab();
      await view.user.keyboard("a");
      await view.user.click(view.getByRole("link", { name: "Direct" }));
      await view.user.click(view.getByRole("link", { name: "Chained" }));
      await view.user.click(view.getByRole("button", { name: "Toggle" }));
      await view.user.click(view.getByRole("button", { name: "Direct" }));
      await view.user.click(view.getByRole("button", { name: "Chained" }));
      await view.expectParity("clicked");
      expect(entries(view)).toEqual([
        "keydown a on a",
        "click on a",
        "chained on a",
        "click on button",
        "chained on button",
      ]);
    },
  );

  it(
    "holds the element that renders in the consumer's ref",
    { requires: ["interactivity", "expose"] },
    async () => {
      const view = await mount(Page);
      await view.user.click(view.getByRole("button", { name: "Focus direct" }));
      await expect.element(view.getByRole("link", { name: "Direct" })).toHaveFocus();
      await view.user.click(view.getByRole("button", { name: "Focus chained" }));
      await expect.element(view.getByRole("link", { name: "Chained" })).toHaveFocus();
      await view.user.click(view.getByRole("button", { name: "Toggle" }));
      await view.user.click(view.getByRole("button", { name: "Focus direct" }));
      await expect.element(view.getByRole("button", { name: "Direct" })).toHaveFocus();
      await view.user.click(view.getByRole("button", { name: "Focus chained" }));
      await view.expectParity("focused");
      await expect.element(view.getByRole("button", { name: "Chained" })).toHaveFocus();
    },
  );
});
