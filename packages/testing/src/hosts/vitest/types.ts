// What specs on Vitest's `expect` need of the port's types: `expect.element` takes Vitest's own
// `Locator`, so the locators a view hands out are typed as both. Types only.
import type { Locator as VitestLocator } from "vitest/browser";

declare module "../../browser/host.ts" {
  // oxlint-disable-next-line typescript/no-empty-object-type -- the heritage is the declaration
  interface Locator extends VitestLocator {}
}
