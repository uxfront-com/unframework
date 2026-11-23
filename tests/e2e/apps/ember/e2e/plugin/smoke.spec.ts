import { assertInstalledFromTarball } from "../../../../harness/apps.ts";
import { expect, test } from "../../../../harness/fixtures.ts";

test("smoke", async ({ page, devServer }) => {
  for (const name of [
    "@unframework.dev/e2e-design-system",
    "@uxfront/unframework",
    "@unframework.dev/unplugin",
  ]) {
    assertInstalledFromTarball(devServer.copy, name);
  }

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hello from Ember, plugin mode" })).toBeVisible();
  await expect(page.locator(".greeting")).toHaveText("Hello, Ember");
});
