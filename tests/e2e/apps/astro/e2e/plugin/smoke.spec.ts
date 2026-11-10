import { expectDesignSystemRendered } from "../../../../harness/design-system.ts";
import { expect, test } from "../../../../harness/fixtures.ts";

test("smoke", async ({ page }) => {
  await page.goto("/");
  const greeting = page.getByRole("heading", { name: "Hello from Astro, plugin mode" });
  await expect(greeting).toBeVisible();
  await expect(greeting).toHaveCSS("color", "rgb(22, 101, 52)");
  // The design system's sources, compiled by the integration in this app. Astro renders on the
  // server only, so the spec stops after the render.
  await expectDesignSystemRendered(page);
});
