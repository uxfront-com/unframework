// The config the driver hands the page (`./protocol.ts`), and the bindings it reaches Node by.
import type { BrowserEngine } from "../../harness.ts";
import { PAGE_CALL, PAGE_CONFIG, PAGE_REPORT } from "./protocol.ts";
import type { PageCallResult, PageEvent, PageHostConfig } from "./protocol.ts";

/** What the driver leaves on the page's global. */
type PageGlobal = {
  [PAGE_CONFIG]?: PageHostConfig;
  [PAGE_CALL]?: (name: string, args: readonly unknown[]) => Promise<PageCallResult>;
  [PAGE_REPORT]?: (event: PageEvent) => Promise<void>;
};

const page = globalThis as PageGlobal;

/** The config the driver handed this page. */
export function pageConfig(): PageHostConfig {
  const config = page[PAGE_CONFIG];
  if (!config) {
    throw new Error(
      `The page host has no config: the driver must set ${PAGE_CONFIG} in an init script, before the page's modules load.`,
    );
  }
  return config;
}

/** The engine this page runs in, which two matchers read as Vitest's do. */
export function pageBrowser(): BrowserEngine {
  return pageConfig().provided.ufHarness.browser;
}

/** Calls a Node command, and throws what it threw, under its own name. */
export async function callNode(name: string, args: readonly unknown[]): Promise<unknown> {
  const call = page[PAGE_CALL];
  if (!call) {
    throw new Error(`The page host has no ${PAGE_CALL} binding, so ${name} cannot reach Node.`);
  }
  const result = await call(name, args);
  if (result.ok) return result.value;
  const error = new Error(result.error.message);
  if (result.error.name) error.name = result.error.name;
  throw error;
}

/** Tells the driver what happened. Awaited, so the records reach it in order. */
export async function report(event: PageEvent): Promise<void> {
  await page[PAGE_REPORT]?.(event);
}
