import { expect, test } from "../../../../harness/fixtures.ts";

test("hmr", async ({ page, edit }) => {
  await page.goto("/");
  const greeting = page.locator(".greeting");
  await expect(greeting).toHaveText("Hello, Vue");
  await page.evaluate(() => Object.assign(window, { marker: true }));

  // A type changes nothing on the page, so Vite's client says what it applied. plugin-vue
  // updates a component when a type file its compiler read changes.
  const updated = page.waitForEvent("console", (message) =>
    message.text().startsWith("[vite] hot updated: /Greeting.uf.tsx.vue"),
  );
  await edit("src/plugin/types.ts", "name: string;", "name: string;\n  tone?: string;");
  await updated;
  await expect(greeting).toHaveText("Hello, Vue");

  await edit("src/plugin/Greeting.uf.tsx", "Hello,", "Goodbye,");
  await expect(greeting).toHaveText("Goodbye, Vue");

  await edit("src/plugin/Greeting.css", "rgb(21, 128, 61)", "rgb(185, 28, 28)");
  await expect(greeting).toHaveCSS("color", "rgb(185, 28, 28)");

  // A full reload would have cleared it.
  expect(await page.evaluate(() => "marker" in window)).toBe(true);
});
