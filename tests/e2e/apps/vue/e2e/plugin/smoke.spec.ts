import { assertInstalledFromTarball } from "../../../../harness/apps.ts";
import {
  expectDesignSystemRendered,
  expectDesignSystemInteractive,
} from "../../../../harness/design-system.ts";
import { expect, test } from "../../../../harness/fixtures.ts";

test("smoke", async ({ page, devServer }) => {
  assertInstalledFromTarball(devServer.copy, "@unframework/e2e-design-system");
  assertInstalledFromTarball(devServer.copy, "@unframework/unplugin");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hello from Vue, plugin mode" })).toBeVisible();
  await expect(page.getByText("Hello, Vue")).toHaveCSS("color", "rgb(21, 128, 61)");
  await expectDesignSystemRendered(page);
  await expectDesignSystemInteractive(page);
});
