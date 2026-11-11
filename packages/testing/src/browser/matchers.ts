// The spec-facing matchers (plan §8.5, ADR-0085), which the setup file registers with
// `expect.extend`. Each judges an element the way its layer judges a view's container:
// - `toHaveNoAxeViolations` runs axe-core with L11's options;
// - `toHaveAriaTree` compares Playwright's ARIA snapshot, normalised as L7 normalises
//   `aria.<name>.yaml`, with one tree that holds on every target.
// Vitest's own `toMatchAriaSnapshot()` and `toMatchAriaInlineSnapshot()` snapshot each target's raw
// tree, one per project, so neither can say "the same tree on every target". These names leave
// them as they are.
import { expect } from "vitest";
import { commands, page } from "vitest/browser";

import "../commands.ts";
import { diffLines } from "../diff.ts";
import { normalizeDomWithIds } from "../dom/serialize.ts";
import { inlineHosts } from "../normalize/rules/aria-hosts.ts";
import { renameGeneratedIds } from "../normalize/rules/generated-ids.ts";
import { isNormalizeTarget } from "../normalize/targets.ts";
import { compareAxe } from "./axe.ts";
import { currentTarget } from "./target.ts";

/** Options for `toHaveNoAxeViolations`. */
export interface NoAxeViolationsOptions {
  /**
   * The axe rule ids the element is known to break, exactly, as case.json's `axe` list is for
   * L11: a rule axe reports that is not listed fails, and so does a listed rule it doesn't
   * report. None by default.
   */
  expected?: readonly string[];
}

declare module "vitest" {
  interface Matchers<R, T> {
    /**
     * Runs axe-core on the element with L11's options, and passes when it reports no violation,
     * or exactly the rules `options.expected` names.
     *
     * @example
     * await expect.element(view.getByRole("button")).toHaveNoAxeViolations();
     */
    toHaveNoAxeViolations(options?: NoAxeViolationsOptions): Promise<void>;
    /**
     * Compares the element's ARIA tree with `expected`, one tree that holds on every target:
     * Playwright's ARIA snapshot, normalised as L7 normalises `aria.<name>.yaml`. Common
     * indentation and the blank lines around `expected` are ignored, so a template literal can
     * hold it.
     *
     * @example
     * await expect.element(view.getByRole("group")).toHaveAriaTree(`
     *   - group:
     *     - button "Save"
     * `);
     */
    toHaveAriaTree(expected: string): Promise<void>;
  }
}

/** Registers the matchers. The setup file calls it once, before any spec runs. */
export function installMatchers(): void {
  expect.extend({
    async toHaveNoAxeViolations(received: unknown, options: NoAxeViolationsOptions = {}) {
      const element = elementOf(received, "toHaveNoAxeViolations");
      const expected = options.expected ?? [];
      const { pass, unexpected, missing } = await compareAxe(element, expected);
      const lines = [...unexpected];
      if (missing.length) lines.push(`  expected but not reported: ${missing.join(", ")}`);
      return {
        pass,
        message: () =>
          pass
            ? `expected axe-core to report a violation other than ${expected.length ? expected.join(", ") : "none"}, but it reported exactly ${expected.length ? "those" : "none"}`
            : `axe-core reported violations on ${currentTarget()}:\n${lines.join("\n")}`,
      };
    },

    async toHaveAriaTree(received: unknown, expected: string) {
      const element = elementOf(received, "toHaveAriaTree");
      if (typeof expected !== "string") {
        throw new TypeError("toHaveAriaTree: the expected tree is a string, in YAML.");
      }
      const target = currentTarget();
      const actual = asTree(await ariaTree(element, target));
      const wanted = asTree(expected);
      const pass = actual === wanted;
      return {
        pass,
        message: () =>
          pass
            ? `expected the ARIA tree on ${target} to differ from:\n${wanted}`
            : `the ARIA tree on ${target} differs:\n${diffLines(wanted, actual)}`,
        actual,
        expected: wanted,
      };
    },
  });
}

/**
 * The matchers take an element: `expect.element(locator)` resolves one, and `expect(element)`
 * passes it as it is.
 */
function elementOf(received: unknown, matcher: string): Element {
  if (received instanceof Element) return received;
  throw new TypeError(
    `${matcher}: expected an element, as \`expect.element(locator)\` resolves one, but received ${received === null ? "null" : typeof received}.`,
  );
}

/**
 * Playwright's ARIA snapshot of `element`, as L7 takes a view's (`aria` in view.ts): with
 * Angular's hosts inline while it is taken (ADR-0060), and the generated ids in its text renamed
 * as the normalised DOM renames them.
 */
async function ariaTree(element: Element, target: string): Promise<string> {
  const normalizeTarget = isNormalizeTarget(target) ? target : undefined;
  const { ids } = normalizeDomWithIds(element, normalizeTarget ? { target: normalizeTarget } : {});
  const restore = inlineHosts(element, normalizeTarget);
  try {
    const snapshot = await commands.ufAriaSnapshot(page.elementLocator(element).serialize());
    return renameGeneratedIds(snapshot, ids);
  } finally {
    restore();
  }
}

/**
 * A tree as the matcher compares it: no blank lines around it, no trailing spaces, and the
 * indentation its lines share removed, so a tree written in an indented template literal reads
 * as the snapshot does.
 */
function asTree(text: string): string {
  const lines = text.split("\n").map((line) => line.trimEnd());
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines.at(-1)) lines.pop();
  const indent = Math.min(
    ...lines.filter(Boolean).map((line) => line.length - line.trimStart().length),
  );
  return lines.map((line) => line.slice(Number.isFinite(indent) ? indent : 0)).join("\n");
}
