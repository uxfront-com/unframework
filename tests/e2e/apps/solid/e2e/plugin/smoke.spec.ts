import { assertInstalledFromTarball } from "../../../../harness/apps.ts";
import {
  expectDesignSystemRendered,
  expectDesignSystemInteractive,
} from "../../../../harness/design-system.ts";
import { expect, test } from "../../../../harness/fixtures.ts";

test("smoke", async ({ page, devServer }) => {
  for (const name of ["@unframework/e2e-design-system", "unframework", "@unframework/unplugin"]) {
    assertInstalledFromTarball(devServer.copy, name);
  }

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hello from Solid, plugin mode" })).toBeVisible();
  await expect(page.locator(".greeting")).toHaveText("Hello, Solid");
  await expect(page.locator(".greeting")).toHaveCSS("color", "rgb(21, 128, 61)");
  await expectDesignSystemRendered(page);
  await expectDesignSystemInteractive(page);
});
