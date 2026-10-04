// props/props-parameter: the object form, `(props: P)`, read as `props.x` in text and in an
// attribute, with an optional prop and no defaults.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import AuthorByline from "./AuthorByline.uf.tsx";

describeTargets("props/props-parameter", () => {
  it("reads every prop through the props object", async () => {
    const view = await mountScenario(AuthorByline, "with-affiliation");
    await view.expectParity("with-affiliation");
    await expect
      .element(view.getByText("By Ada Lovelace, Analytical Society", { exact: false }))
      .toBeVisible();
    await expect.element(view.getByText("1843-10-01")).toHaveAttribute("datetime", "1843-10-01");
    await expect.element(view.getByText("· 7 min read", { exact: false })).toBeVisible();
  });

  it("falls back for the absent optional prop", async () => {
    const view = await mountScenario(AuthorByline, "independent");
    await view.expectParity("independent");
    await expect
      .element(view.getByText("By Mary Somerville, independent", { exact: false }))
      .toBeVisible();
    await expect.element(view.getByText("1834-01-01")).toHaveAttribute("datetime", "1834-01-01");
  });
});
