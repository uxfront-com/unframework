import { expect, test } from "../../../../harness/fixtures.ts";

test("hmr", async ({ page, edit }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hello from Vue" })).toBeVisible();
  await page.evaluate(() => Object.assign(window, { marker: true }));

  await edit("src/package/Hello.vue", "Hello from", "Goodbye from");

  await expect(page.getByRole("heading", { name: "Goodbye from Vue" })).toBeVisible();
  // A full reload would have cleared it.
  expect(await page.evaluate(() => "marker" in window)).toBe(true);
});
