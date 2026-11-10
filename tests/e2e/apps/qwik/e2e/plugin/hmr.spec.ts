import { expect, test } from "../../../../harness/fixtures.ts";

// The plugin reloads a client-rendered Qwik page for every edit (ADR-0075), so each step waits for
// the reload and asserts the new content.
test("hmr", async ({ page, edit }) => {
  let loads = 0;
  page.on("load", () => loads++);
  await page.goto("/");
  const greeting = page.locator(".greeting");
  await expect(greeting).toHaveText("Hello, Qwik");
  await expect(greeting).toHaveCSS("color", "rgb(21, 128, 61)");

  let before = loads;
  await edit("src/plugin/Greeting.uf.tsx", "Hello,", "Goodbye,");
  await expect.poll(() => loads).toBeGreaterThan(before);
  await expect(greeting).toHaveText("Goodbye, Qwik");
  await expect(greeting).toHaveCSS("color", "rgb(21, 128, 61)");

  // A new prop changes the shape the component reads, so its module compiles again, and nothing
  // on the page shows it: the reload is what to look for.
  before = loads;
  await edit("src/plugin/types.ts", "name: string;", "name: string;\n  title?: string;");
  await expect.poll(() => loads).toBeGreaterThan(before);
  await expect(greeting).toHaveText("Goodbye, Qwik");
  await expect(greeting).toHaveCSS("color", "rgb(21, 128, 61)");

  before = loads;
  await edit("src/plugin/Greeting.css", "rgb(21, 128, 61)", "rgb(185, 28, 28)");
  await expect.poll(() => loads).toBeGreaterThan(before);
  await expect(greeting).toHaveText("Goodbye, Qwik");
  await expect(greeting).toHaveCSS("color", "rgb(185, 28, 28)");
});
