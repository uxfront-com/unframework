import { expect, test } from "../../../../harness/fixtures.ts";

// Qwik applies an edit its own way, in place or by reloading the page, so each step asserts the
// new content rather than how it arrived.
test("hmr", async ({ page, edit }) => {
  // What Vite's client logs once it has applied an update, and the page's loads.
  const updated: string[] = [];
  page.on("console", (message) => {
    const [, path] = /^\[vite\] hot updated: (.+)$/.exec(message.text()) ?? [];
    if (path) updated.push(path);
  });
  let loads = 0;
  page.on("load", () => loads++);
  await page.goto("/");
  const greeting = page.locator(".greeting");
  await expect(greeting).toHaveText("Hello, Qwik");
  await expect(greeting).toHaveCSS("color", "rgb(21, 128, 61)");

  await edit("src/plugin/Greeting.uf.tsx", "Hello,", "Goodbye,");
  await expect(greeting).toHaveText("Goodbye, Qwik");

  // A new prop changes the shape the component reads, so its module compiles again, and nothing
  // on the page shows it: an update of one of its segments, or a reload, is what to look for.
  updated.length = 0;
  const before = loads;
  await edit("src/plugin/types.ts", "name: string;", "name: string;\n  title?: string;");
  await expect
    .poll(() => loads > before || updated.some((path) => path.startsWith("/Greeting.uf.tsx_")))
    .toBe(true);
  await expect(greeting).toHaveText("Goodbye, Qwik");

  await edit("src/plugin/Greeting.css", "rgb(21, 128, 61)", "rgb(185, 28, 28)");
  await expect(greeting).toHaveCSS("color", "rgb(185, 28, 28)");
  await expect(greeting).toHaveText("Goodbye, Qwik");
});
