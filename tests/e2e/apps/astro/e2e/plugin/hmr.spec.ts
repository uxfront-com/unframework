import type { Page } from "@playwright/test";

import type { Edit } from "../../../../harness/edit.ts";
import { expect, test } from "../../../../harness/fixtures.ts";

// Astro answers an edit with a full reload (ADR-0075), so each test waits for that reload's `load`
// event: the new content came through a reload, since nothing else navigates the page. Nothing
// evaluates in the page meanwhile, because a reload that lands mid-evaluate destroys its context.
// The listener starts before the edit, because the reload can come before the edit resolves.
const editAndReload = async (page: Page, edit: Edit, ...change: Parameters<Edit>) => {
  const reloaded = page.waitForEvent("load");
  await edit(...change);
  await reloaded;
};

const greeting = (page: Page, name = "Hello from Astro, plugin mode") =>
  page.getByRole("heading", { name });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(greeting(page)).toBeVisible();
});

test("a component edit reloads with the new content", async ({ page, edit }) => {
  await editAndReload(page, edit, "src/plugin/Greeting.uf.tsx", "Hello from", "Goodbye from");
  await expect(greeting(page, "Goodbye from Astro, plugin mode")).toBeVisible();
});

test("a stylesheet edit reloads with the new style", async ({ page, edit }) => {
  await editAndReload(
    page,
    edit,
    "src/plugin/Greeting.css",
    "rgb(22, 101, 52)",
    "rgb(153, 27, 27)",
  );
  await expect(greeting(page)).toHaveCSS("color", "rgb(153, 27, 27)");
});

test("an edit to a type the component reads reloads the page", async ({ page, edit }) => {
  // A type changes nothing on the page, so the reload is what shows the edit reached it: Greeting
  // reads its props from this module, and an edit to a module the page never reaches reloads
  // nothing.
  await editAndReload(
    page,
    edit,
    "src/plugin/types.ts",
    "name: string;",
    "name: string;\n  tone?: string;",
  );
  await expect(greeting(page)).toBeVisible();
});
