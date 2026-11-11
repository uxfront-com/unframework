import { assertInstalledFromTarball } from "../../../../harness/apps.ts";
import {
  expectDesignSystemRendered,
  expectDesignSystemInteractive,
} from "../../../../harness/design-system.ts";
import { expect, test } from "../../../../harness/fixtures.ts";

test("smoke", async ({ page, devServer }) => {
  assertInstalledFromTarball(devServer.copy, "@unframework.dev/e2e-design-system");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hello from Solid, package mode" })).toBeVisible();
  await expectDesignSystemRendered(page);
  await expectDesignSystemInteractive(page);
});
