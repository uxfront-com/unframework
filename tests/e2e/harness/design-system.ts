// The checks every app's package-mode smoke spec shares, so each framework is held to one page.
import { expect, type Page } from "@playwright/test";

const button = (page: Page) => page.getByRole("button", { name: "Press me" });

/** Every component rendered from the tarball, with its slots, and the design system's sheet applied. */
export async function expectDesignSystemRendered(page: Page): Promise<void> {
  await expect(button(page)).toBeVisible();
  await expect(button(page)).toHaveAttribute("data-variant", "primary");
  await expect(button(page)).toHaveCSS("background-color", "rgb(30, 64, 175)");

  await expect(page.getByRole("status")).toHaveText("2");
  await expect(page.getByText("Doubled: 4")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add 3" })).toBeVisible();

  await expect(page.getByRole("textbox", { name: "Name" })).toBeVisible();

  const card = page.getByRole("article");
  await expect(card.locator("header")).toContainText("Card header");
  await expect(card.locator(".body")).toContainText("Toggle card");
  await expect(card.locator("footer")).toContainText("Closed");
}

/** One interaction per component. Astro renders on the server only, so it never calls this. */
export async function expectDesignSystemInteractive(page: Page): Promise<void> {
  await button(page).click();
  await expect(page.getByText("Presses: 1")).toBeVisible();

  await page.getByRole("button", { name: "Add 3" }).click();
  await expect(page.getByRole("status")).toHaveText("5");
  await expect(page.getByText("Doubled: 10")).toBeVisible();

  await page.getByRole("textbox", { name: "Name" }).fill("Ada");
  await expect(page.getByText("Name: Ada")).toBeVisible();

  // The card's slots are the app's, so its update shows they stay live inside the component.
  await page.getByRole("button", { name: "Toggle card" }).click();
  await expect(page.getByRole("article").locator("footer")).toContainText("Open");
}
