import { expect, test } from "../../../../harness/fixtures.ts";

test("hmr", async ({ page, edit }) => {
  await page.goto("/");
  const greeting = page.locator(".greeting");
  await expect(greeting).toHaveText("Hello, React");
  await page.evaluate(() => Object.assign(window, { marker: true }));

  // A new prop changes the shape the component reads, so its module compiles again, and nothing
  // on the page shows it: Vite's client says what it applied. First, so that no earlier edit's
  // update can log the same path.
  const updated = page.waitForEvent("console", (message) =>
    message.text().startsWith("[vite] hot updated: /Greeting.uf.tsx"),
  );
  await edit("src/plugin/types.ts", "name: string;", "name: string;\n  title?: string;");
  await updated;
  await expect(greeting).toHaveText("Hello, React");

  await edit("src/plugin/Greeting.uf.tsx", "Hello,", "Goodbye,");
  await expect(greeting).toHaveText("Goodbye, React");

  await edit("src/plugin/Greeting.css", "rgb(21, 128, 61)", "rgb(185, 28, 28)");
  await expect(greeting).toHaveCSS("color", "rgb(185, 28, 28)");

  // A full reload would have cleared it.
  expect(await page.evaluate(() => "marker" in window)).toBe(true);
});
