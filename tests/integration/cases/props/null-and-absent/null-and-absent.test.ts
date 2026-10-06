// props/null-and-absent: an optional prop that may be `null` tells `null` from absent, in text
// and in a bound attribute; the empty string and `false` are values too.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import ContactLine from "./ContactLine.uf.tsx";

describeTargets("props/null-and-absent", () => {
  it("renders the absent branches when the props are left out", async () => {
    const view = await mountScenario(ContactLine, "absent");
    await view.expectParity("absent");
    await expect.element(view.getByText("Phone: not given yet")).not.toHaveAttribute("data-phone");
    await expect.element(view.getByText("Not verified")).toBeVisible();
  });

  it("renders the null branches when the props are null", async () => {
    const view = await mountScenario(ContactLine, "null-values");
    await view.expectParity("null-values");
    await expect
      .element(view.getByText("Phone: withheld"))
      .toHaveAttribute("data-phone", "withheld");
    await expect.element(view.getByText("Verification pending")).toBeVisible();
  });

  it("renders the given values", async () => {
    const view = await mountScenario(ContactLine, "given");
    await view.expectParity("given");
    await expect
      .element(view.getByText("Phone: +44 20 7946 0000"))
      .toHaveAttribute("data-phone", "+44 20 7946 0000");
    await expect.element(view.getByText("Verified")).toBeVisible();
  });

  it("renders the empty string and false as values", async () => {
    const view = await mountScenario(ContactLine, "empty-and-false");
    await view.expectParity("empty-and-false");
    await expect.element(view.getByText("Phone:")).toHaveAttribute("data-phone", "");
    await expect.element(view.getByText("Not verified")).toBeVisible();
  });
});
