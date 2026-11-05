import { expect, test } from "../../../../harness/fixtures.ts";

test("smoke", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hello from React, plugin mode" })).toBeVisible();
});
