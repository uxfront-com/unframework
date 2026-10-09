// context/fallback: `inject(LocaleKey, "en")` reads its fallback where no ancestor provides the
// key, and the provided value where one does (ADR-0054). The provider passes its children on
// through its default slot.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Page from "./Page.uf.tsx";

describeTargets("context/fallback", () => {
  it("reads the fallback outside a provider and the value inside one", async () => {
    const view = await mount(Page);
    await view.expectParity("initial");
    await expect.element(view.getByText("Hello, Ada (en)")).toBeVisible();
    await expect.element(view.getByText("Olá, Inês (pt)")).toBeVisible();
  });
});
