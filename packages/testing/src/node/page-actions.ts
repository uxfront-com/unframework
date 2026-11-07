// The actions Vitest's `userEvent` runs in one call of Playwright, for the page host
// (`../hosts/page/`), as Vitest's own provider runs them (`vitest-dev/vitest@v5.0.3`,
// packages/browser-playwright/src/commands), so a timeout gives Playwright's text, which the L8
// canary reads (`tests/integration/harness/canaries.ts`).
import type { SerializedLocatorLike } from "../commands.ts";

/** The part of a Playwright locator the actions call. */
interface ActionLocator {
  hover(): Promise<void>;
  fill(text: string): Promise<void>;
  clear(): Promise<void>;
  selectOption(values: readonly string[]): Promise<unknown>;
}

/** What the actions need from their driver: the frame the spec runs in. */
export interface PageActionContext {
  iframe: { locator(selector: string): ActionLocator };
}

/** Vitest's target for an `unhover`: the body, whatever the spec named. */
const BODY = "html > body";

/** `ufUnhover`: moves the mouse onto the frame's body. */
export async function ufUnhover(context: PageActionContext): Promise<void> {
  await context.iframe.locator(BODY).hover();
}

/** `ufFill`: replaces a field's text, as pasting it would. */
export async function ufFill(
  context: PageActionContext,
  target: SerializedLocatorLike,
  text: string,
): Promise<void> {
  await context.iframe.locator(target.selector).fill(text);
}

/** `ufClear`: removes a field's text. */
export async function ufClear(
  context: PageActionContext,
  target: SerializedLocatorLike,
): Promise<void> {
  await context.iframe.locator(target.selector).clear();
}

/** `ufSelectOptions`: selects the options of a `<select>` with these values or labels. */
export async function ufSelectOptions(
  context: PageActionContext,
  target: SerializedLocatorLike,
  values: readonly string[],
): Promise<void> {
  await context.iframe.locator(target.selector).selectOption(values);
}

/** The page host's actions, keyed by the name the page calls. */
export const pageActions: {
  ufUnhover: typeof ufUnhover;
  ufFill: typeof ufFill;
  ufClear: typeof ufClear;
  ufSelectOptions: typeof ufSelectOptions;
} = { ufUnhover, ufFill, ufClear, ufSelectOptions };
