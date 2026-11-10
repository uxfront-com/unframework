import type { Page } from "@playwright/test";

import { expect, test } from "../../../../harness/fixtures.ts";

// Astro answers an edit with a full reload (ADR-0075), so each test marks the page first and
// expects the mark gone: the new content came through that reload, not from a navigation.
const markPage = async (page: Page): Promise<void> => {
  await page.evaluate(() => Object.assign(window, { marker: true }));
};

const expectReloaded = (page: Page): Promise<void> =>
  expect.poll(() => page.evaluate(() => "marker" in window)).toBe(false);

const greeting = (page: Page, name = "Hello from Astro, plugin mode") =>
  page.getByRole("heading", { name });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(greeting(page)).toBeVisible();
  await markPage(page);
});

test("a component edit reloads with the new content", async ({ page, edit }) => {
  await edit("src/plugin/Greeting.uf.tsx", "Hello from", "Goodbye from");
  await expect(greeting(page, "Goodbye from Astro, plugin mode")).toBeVisible();
  await expectReloaded(page);
});

test("a stylesheet edit reloads with the new style", async ({ page, edit }) => {
  await edit("src/plugin/Greeting.css", "rgb(22, 101, 52)", "rgb(153, 27, 27)");
  await expect(greeting(page)).toHaveCSS("color", "rgb(153, 27, 27)");
  await expectReloaded(page);
});

test("an edit to a type the component reads reloads the page", async ({ page, edit }) => {
  // A type changes nothing on the page, so the reload is what shows the edit reached it: Greeting
  // reads its props from this module, and an edit to a module the page never reaches reloads
  // nothing.
  await edit("src/plugin/types.ts", "name: string;", "name: string;\n  tone?: string;");
  await expectReloaded(page);
  await expect(greeting(page)).toBeVisible();
});
