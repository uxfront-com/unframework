import { assertInstalledFromTarball } from "../../../../harness/apps.ts";
import {
  expectDesignSystemRendered,
  expectDesignSystemInteractive,
} from "../../../../harness/design-system.ts";
import { expect, test } from "../../../../harness/fixtures.ts";

test("smoke", async ({ page, devServer }) => {
  assertInstalledFromTarball(devServer.copy, "@unframework.dev/e2e-design-system");
  assertInstalledFromTarball(devServer.copy, "@unframework.dev/unplugin");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hello from Svelte, plugin mode" })).toBeVisible();
  await expect(page.getByText("Hello, Svelte")).toHaveCSS("color", "rgb(21, 128, 61)");
  await expectDesignSystemRendered(page);
  await expectDesignSystemInteractive(page);
});
