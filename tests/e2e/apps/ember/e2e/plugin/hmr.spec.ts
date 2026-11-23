import { expect, test } from "../../../../harness/fixtures.ts";

// @embroider/vite replaces no module in place, so Vite reloads the page after each edit: the
// page shows the new component, from the plugin's new compile.
test("hmr", async ({ page, edit }) => {
  await page.goto("/");
  const greeting = page.locator(".greeting");
  await expect(greeting).toHaveText("Hello, Ember");

  // A new prop changes the shape the component reads, so its module compiles again, and nothing
  // on the page shows it.
  await edit("src/plugin/types.ts", "name: string;", "name: string;\n  title?: string;");
  await expect(greeting).toHaveText("Hello, Ember");

  await edit("src/plugin/Greeting.uf.tsx", "Hello,", "Goodbye,");
  await expect(greeting).toHaveText("Goodbye, Ember");
});
