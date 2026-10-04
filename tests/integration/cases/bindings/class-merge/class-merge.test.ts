// bindings/class-merge: a typed spread whose `class` key merges with the element's own class,
// static on one element and a class binding on the other; the spread's other keys render as
// attributes.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import TextLink from "./TextLink.uf.tsx";

describeTargets("bindings/class-merge", () => {
  it("merges the spread classes with the element's classes", async () => {
    const view = await mountScenario(TextLink, "merged");
    await view.expectParity("merged");
    const link = view.getByRole("link", { name: "Read the docs" });
    await expect.element(link).toHaveClass("text-link external underline", { exact: true });
    await expect.element(link).toHaveAttribute("rel", "noopener");
    await expect.element(link).toHaveAttribute("title", "Opens the documentation");
    const row = view.getByRole("paragraph");
    await expect
      .element(row)
      .toHaveClass("link-row link-row-strong row-highlight", { exact: true });
    await expect.element(row).toHaveAttribute("id", "docs-link-row");
  });

  it("keeps only the element's classes when the spread adds none", async () => {
    const view = await mountScenario(TextLink, "own-classes");
    await view.expectParity("own-classes");
    const link = view.getByRole("link", { name: "Changelog" });
    await expect.element(link).toHaveClass("text-link", { exact: true });
    await expect.element(link).toHaveAttribute("href", "/changelog");
  });
});
