// fallthrough/dynamic-root: a component whose root is a `<component is>` over tags takes a
// consumer's `class` and `style`, directly or through a component whose root it is, and its
// styled parent's scope attribute, whichever tag renders (ADR-0119). An attribute only some tags
// take renders on those alone: a link never has `disabled`, a button never `href`.
import { describeTargets, it, mount } from "@unframework.dev/testing";
import { expect } from "vitest";

import Page from "./Page.uf.tsx";

/** The page's sheet reaches an element only through its scope attribute. */
const SCOPED = { borderTopColor: "rgb(220, 38, 38)" };

describeTargets("fallthrough/dynamic-root", () => {
  it("merges the class and the style into whichever tag renders", async () => {
    const view = await mount(Page);
    await view.expectParity("initial");
    const docs = view.getByRole("link", { name: "Docs" });
    await expect.element(docs).toHaveAttribute("href", "#docs");
    await expect.element(docs).not.toHaveAttribute("disabled");
    await expect.element(docs).toHaveClass("base", "primary", "wide");
    await expect.element(docs).toHaveStyle({ ...SCOPED, color: "rgb(29, 78, 216)" });
    await expect.element(docs).toHaveStyle({ paddingTop: "4px", minWidth: "160px" });
    const off = view.getByRole("button", { name: "Off" });
    await expect.element(off).not.toHaveAttribute("href");
    await expect.element(off).toBeDisabled();
    await expect.element(off).toHaveClass("base", "off");
    await expect.element(off).not.toHaveClass("muted");
    await expect.element(off).toHaveStyle(SCOPED);
    const save = view.getByRole("button", { name: "Save" });
    await expect.element(save).not.toHaveAttribute("href");
    await expect.element(save).not.toHaveAttribute("disabled");
    await expect.element(save).toHaveClass("base", "save");
    await expect.element(save).toHaveStyle(SCOPED);
  });

  it("renders each row's attributes on the tag it renders", async () => {
    const view = await mount(Page);
    const items = view.getByRole("list", { name: "Items" });
    await expect.element(items.getByRole("link", { name: "One" })).toHaveAttribute("href", "#one");
    await expect.element(items.getByRole("link", { name: "One" })).not.toHaveAttribute("disabled");
    await expect.element(items.getByRole("button", { name: "Two" })).not.toHaveAttribute("href");
    await expect.element(items.getByRole("button", { name: "Two" })).toBeDisabled();
  });

  it("moves the attributes as the tag changes", { requires: ["interactivity"] }, async () => {
    const view = await mount(Page);
    await view.user.click(view.getByRole("button", { name: "Toggle" }));
    await view.expectParity("toggled");
    const docs = view.getByRole("button", { name: "Docs" });
    await expect.element(docs).not.toHaveAttribute("href");
    await expect.element(docs).toBeDisabled();
    await expect.element(docs).toHaveClass("base", "primary", "wide");
    await expect.element(docs).toHaveStyle({ ...SCOPED, color: "rgb(21, 128, 61)" });
    await expect.element(view.getByRole("link", { name: "Docs" })).not.toBeInTheDocument();
    await expect.element(view.getByRole("button", { name: "Off" })).toHaveClass("off", "muted");
  });

  it("runs the root's listener on each tag", { requires: ["interactivity"] }, async () => {
    const view = await mount(Page);
    await view.user.click(view.getByRole("button", { name: "Save" }));
    await expect.element(view.getByRole("status")).toHaveTextContent("save");
    await view.user.click(view.getByRole("link", { name: "Docs" }));
    await view.expectParity("pressed");
    await expect.element(view.getByRole("status")).toHaveTextContent("docs");
  });
});
