// The rules of `normalizeHtml` in their order, over a fragment that is already parsed: the live
// DOM path (`normalizeDom`) parses once, checks the tree against the live one, then normalises.
import { printTree } from "./print.ts";
import { unwrapAngularHosts } from "./rules/angular-hosts.ts";
import { removeComments } from "./rules/comments.ts";
import { removeFrameworkAttributes } from "./rules/framework-attributes.ts";
import { canonicalizeGeneratedIds } from "./rules/generated-ids.ts";
import { canonicalizeClasses, sortAttributes } from "./rules/ordering.ts";
import { canonicalizeBooleanAttributes, canonicalizeStyles } from "./rules/values.ts";
import { collapseWhitespace } from "./rules/whitespace.ts";
import { isNormalizeTarget } from "./targets.ts";
import type { NormalizeTarget } from "./targets.ts";
import type { TreeFragment } from "./tree.ts";

export interface NormalizeOptions {
  /**
   * The target that rendered the HTML. Its framework's noise (attributes it adds on its own,
   * Angular's component hosts) is removed, and no other framework's: without a target nothing
   * is noise, so the reference's output is never rewritten by another framework's rules.
   */
  target?: NormalizeTarget;
}

/** Refuses a target the normaliser does not know, from an untyped caller. */
export function checkOptions(options: NormalizeOptions): void {
  if (options.target !== undefined && !isNormalizeTarget(options.target)) {
    throw new TypeError(`normalizeHtml: unknown target ${JSON.stringify(options.target)}`);
  }
}

/** Runs the rules over a parsed fragment, in place, and prints it (see `normalizeHtml`). */
export function normalizeTree(root: TreeFragment, options: NormalizeOptions): string {
  checkOptions(options);
  const { target } = options;
  removeComments(root);
  removeFrameworkAttributes(root, target);
  unwrapAngularHosts(root, target);
  canonicalizeStyles(root);
  canonicalizeBooleanAttributes(root, target);
  canonicalizeClasses(root);
  sortAttributes(root);
  collapseWhitespace(root);
  canonicalizeGeneratedIds(root);
  return printTree(root);
}
