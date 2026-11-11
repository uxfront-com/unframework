import { expect, test } from "../../../../harness/fixtures.ts";

test("hmr", async ({ page, edit }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hello from Angular" })).toBeVisible();
  await page.evaluate(() => Object.assign(window, { marker: true }));

  await edit("src/package/Hello.ts", "Hello from", "Goodbye from");

  await expect(page.getByRole("heading", { name: "Goodbye from Angular" })).toBeVisible();
  // A full reload would have cleared it.
  expect(await page.evaluate(() => "marker" in window)).toBe(true);
});
