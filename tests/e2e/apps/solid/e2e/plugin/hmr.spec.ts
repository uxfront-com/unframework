import { expect, test } from "../../../../harness/fixtures.ts";

test("hmr", async ({ page, edit }) => {
  // What Vite's client logs once it has applied an update, one line per module.
  const updated: string[] = [];
  page.on("console", (message) => {
    const [, path] = /^\[vite\] hot updated: (.+)$/.exec(message.text()) ?? [];
    if (path) updated.push(path);
  });
  await page.goto("/");
  const greeting = page.locator(".greeting");
  await expect(greeting).toHaveText("Hello, Solid");
  await page.evaluate(() => Object.assign(window, { marker: true }));

  await edit("src/plugin/Greeting.uf.tsx", "Hello,", "Goodbye,");
  await expect(greeting).toHaveText("Goodbye, Solid");

  await edit("src/plugin/Greeting.css", "rgb(21, 128, 61)", "rgb(185, 28, 28)");
  await expect(greeting).toHaveCSS("color", "rgb(185, 28, 28)");

  // A new prop changes the shape the component reads, so its module compiles again, and nothing
  // on the page shows it: the update itself is what to look for.
  updated.length = 0;
  await edit("src/plugin/types.ts", "name: string;", "name: string;\n  title?: string;");
  await expect.poll(() => updated).toContain("/Greeting.uf.tsx");
  await expect(greeting).toHaveText("Goodbye, Solid");

  // A full reload would have cleared it.
  expect(await page.evaluate(() => "marker" in window)).toBe(true);
});
