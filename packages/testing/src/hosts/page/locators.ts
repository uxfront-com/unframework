import { stringify } from "@vitest/utils/display";
// The page host's locators, on the selector engine Vitest uses, `ivya`. A locator serialises to Playwright's selector, which the
// Node commands resolve, and to the string a trace step names its target by, so traces stay as
// committed. An element that cannot be found fails with Vitest's error, which L8 records.
//
// Ported from Vitest 5.0.3 (`vitest-dev/vitest@v5.0.3`, packages/browser/src/client/tester/locators.ts
// and packages/browser-playwright/src/locators.ts). MIT License, Copyright (c) 2021-Present VoidZero
// Inc. and Vitest contributors.
import {
  asLocator,
  getByAltTextSelector,
  getByLabelSelector,
  getByPlaceholderSelector,
  getByRoleSelector,
  getByTestIdSelector,
  getByTextSelector,
  getByTitleSelector,
  Ivya,
} from "ivya";
import type { ParsedSelector } from "ivya";
import { generateAriaTree, renderAriaTree } from "ivya/aria";

import type {
  LocatorByRoleOptions,
  LocatorFilterOptions,
  LocatorOptions,
} from "../../browser/host.ts";
import type { SerializedLocatorLike } from "../../commands.ts";
import { pageBrowser } from "./config.ts";

/** Vitest's default `browser.locators.testIdAttribute`, which `view.ts`'s roots carry. */
const TEST_ID_ATTRIBUTE = "data-testid";

/** How long `findElement` waits between tries, as Vitest's does. */
const WAIT_INTERVALS = [0, 20, 50, 100, 100, 500];

/** The most of the page's HTML an element error prints, as Vitest's default `DEBUG_PRINT_LIMIT`. */
const PRINT_LIMIT = 7000;

/**
 * The selector engine. Made as this module loads, as Vitest's is, because `Ivya.create` also sets
 * what the `getBy*` helpers read when a locator is built: a locator made before it would be neither
 * exact nor name itself as Vitest's does.
 */
const selectorEngine: Ivya = Ivya.create({
  // Vitest's default `browser.locators.exact`, which the strings a trace holds were made under.
  exact: true,
  browser: pageBrowser(),
  testIdAttribute: TEST_ID_ATTRIBUTE,
});

/** What marks a locator for `expect.element`, whichever copy of this module made it. */
export const LOCATOR_MARK: unique symbol = Symbol.for("$$vitest:locator");

/** An element query that stays valid as the DOM changes. */
export class PageLocator {
  readonly selector: string;
  /** The element this locator was made from, which an element error prints instead of the body. */
  private readonly container: Element | undefined;
  private parsed: ParsedSelector | undefined;
  private described: string | undefined;

  constructor(selector: string, container?: Element) {
    this.selector = selector;
    this.container = container;
    Object.defineProperty(this, LOCATOR_MARK, { value: LOCATOR_MARK });
  }

  private locator(selector: string): PageLocator {
    return new PageLocator(`${this.selector} >> ${selector}`, this.container);
  }

  getByRole(role: string, options?: LocatorByRoleOptions): PageLocator {
    return this.locator(getByRoleSelector(role, options));
  }

  getByAltText(text: string | RegExp, options?: LocatorOptions): PageLocator {
    return this.locator(getByAltTextSelector(text, options));
  }

  getByLabelText(text: string | RegExp, options?: LocatorOptions): PageLocator {
    return this.locator(getByLabelSelector(text, options));
  }

  getByPlaceholder(text: string | RegExp, options?: LocatorOptions): PageLocator {
    return this.locator(getByPlaceholderSelector(text, options));
  }

  getByTestId(text: string | RegExp): PageLocator {
    return this.locator(getByTestIdSelector(TEST_ID_ATTRIBUTE, text));
  }

  getByText(text: string | RegExp, options?: LocatorOptions): PageLocator {
    return this.locator(getByTextSelector(text, options));
  }

  getByTitle(text: string | RegExp, options?: LocatorOptions): PageLocator {
    return this.locator(getByTitleSelector(text, options));
  }

  filter(filter: LocatorFilterOptions): PageLocator {
    const selectors: string[] = [];
    if (filter.hasText) {
      selectors.push(`internal:has-text=${escapeForTextSelector(filter.hasText)}`);
    }
    if (filter.hasNotText) {
      selectors.push(`internal:has-not-text=${escapeForTextSelector(filter.hasNotText)}`);
    }
    if (filter.has) selectors.push(`internal:has=${JSON.stringify(filter.has.selector)}`);
    if (filter.hasNot) selectors.push(`internal:has-not=${JSON.stringify(filter.hasNot.selector)}`);
    if (!selectors.length) {
      throw new Error("Locator.filter expects at least one filter. None provided.");
    }
    return this.locator(selectors.join(" >> "));
  }

  and(locator: { selector: string }): PageLocator {
    return this.locator(`internal:and=${JSON.stringify(locator.selector)}`);
  }

  or(locator: { selector: string }): PageLocator {
    return this.locator(`internal:or=${JSON.stringify(locator.selector)}`);
  }

  query(): HTMLElement | SVGElement | null {
    return selectorEngine.querySelector(this.parsedSelector(), document.documentElement, true) as
      | HTMLElement
      | SVGElement
      | null;
  }

  element(): HTMLElement | SVGElement {
    const element = this.query();
    if (!element) throw elementError(this, this.container ?? document.body);
    return element;
  }

  elements(): (HTMLElement | SVGElement)[] {
    return selectorEngine.querySelectorAll(this.parsedSelector(), document.documentElement) as (
      | HTMLElement
      | SVGElement
    )[];
  }

  get length(): number {
    return this.elements().length;
  }

  all(): PageLocator[] {
    return this.elements().map(
      (element) => new PageLocator(selectorEngine.generateSelectorSimple(element), element),
    );
  }

  nth(index: number): PageLocator {
    return this.locator(`nth=${index}`);
  }

  first(): PageLocator {
    return this.nth(0);
  }

  last(): PageLocator {
    return this.nth(-1);
  }

  toString(): string {
    return this.selector;
  }

  serialize(): SerializedLocatorLike {
    return { selector: this.selector, locator: this.asLocator() };
  }

  asLocator(): string {
    this.described ??= asLocator("javascript", this.selector);
    return this.described;
  }

  toJSON(): SerializedLocatorLike {
    return this.serialize();
  }

  /** The one element this locator matches, tried until the `timeout` passes. */
  async findElement(options: { timeout?: number } = {}): Promise<HTMLElement | SVGElement> {
    const { timeout } = options;
    const start = Date.now();
    let tries = 0;
    while (true) {
      const elements = this.elements();
      if (elements.length === 1) return elements[0]!;
      if (elements.length > 1) throw strictModeError(this, elements);
      const elapsed = Date.now() - start;
      if (timeout !== undefined && elapsed >= timeout) {
        throw elementError(this, this.container ?? document.body);
      }
      const interval = WAIT_INTERVALS[Math.min(tries++, WAIT_INTERVALS.length - 1)]!;
      const wait = timeout === undefined ? interval : Math.min(interval, timeout - elapsed);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  private parsedSelector(): ParsedSelector {
    this.parsed ??= selectorEngine.parseSelector(this.selector);
    return this.parsed;
  }
}

/** The page's own query that the port names. */
export function getByTestId(text: string | RegExp): PageLocator {
  return new PageLocator(getByTestIdSelector(TEST_ID_ATTRIBUTE, text));
}

/** Vitest's `utils.getElementError`, with its `all` format: the ARIA tree, then the HTML. */
function elementError(locator: PageLocator, container: Element): Error {
  const html = stringify(container, Number.POSITIVE_INFINITY, {
    maxLength: PRINT_LIMIT,
    highlight: true,
  });
  const printed =
    container.outerHTML.length > PRINT_LIMIT ? `${html.slice(0, PRINT_LIMIT)}...` : html;
  const error = new Error(
    `Cannot find element with locator: ${locator.asLocator()}\n\nARIA tree:\n${renderAriaTree(generateAriaTree(container))}\n\nHTML:\n${printed}`,
  );
  error.name = "VitestBrowserElementError";
  return error;
}

function strictModeError(locator: PageLocator, matches: readonly Element[]): Error {
  const lines = matches.slice(0, 10).map((match, index) => {
    const preview = selectorEngine.previewNode(match);
    const selector = selectorEngine.generateSelectorSimple(match);
    return `\n    ${index + 1}) ${preview} aka ${asLocator("javascript", selector)}`;
  });
  if (matches.length > 10) lines.push("\n    ...");
  return new Error(
    `strict mode violation: ${locator.asLocator()} resolved to ${matches.length} elements:${lines.join("")}\n`,
  );
}

function escapeForTextSelector(text: string | RegExp): string {
  return typeof text === "string" ? `${JSON.stringify(text)}i` : escapeRegexForSelector(text);
}

/** Unicode mode allows no identity escapes, so such a pattern goes as written, as in Vitest. */
function escapeRegexForSelector(regex: RegExp): string {
  if (regex.unicode || regex.unicodeSets) return String(regex);
  return String(regex)
    .replace(/(^|[^\\])(\\\\)*(["'`])/g, "$1$2\\$3")
    .replace(/>>/g, "\\>\\>");
}
