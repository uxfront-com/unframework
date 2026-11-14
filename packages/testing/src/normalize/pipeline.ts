// The rules of `normalizeHtml` in their order, over a fragment that is already parsed: the live
// DOM path (`normalizeDom`) parses once, checks the tree against the live one, then normalises.
import { BROWSER_ENGINES } from "../harness.ts";
import type { BrowserEngine } from "../harness.ts";
import { printTree } from "./print.ts";
import { unwrapAngularHosts } from "./rules/angular-hosts.ts";
import { removeComments } from "./rules/comments.ts";
import {
  removeReactDefaultStates,
  removeServerControlStates,
  removeSettledValues,
} from "./rules/control-values.ts";
import { renameEngineAliases } from "./rules/engine-aliases.ts";
import { removeFrameworkAttributes } from "./rules/framework-attributes.ts";
import { canonicalizeGeneratedIds } from "./rules/generated-ids.ts";
import { canonicalizeClasses, sortAttributes } from "./rules/ordering.ts";
import { unwrapQwikContainers } from "./rules/qwik-containers.ts";
import { removeQwikStyles } from "./rules/qwik-styles.ts";
import { removeQwikTemplates } from "./rules/qwik-templates.ts";
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
  /**
   * The engine the live DOM was read in (`UF_BROWSER`, ADR-0081). The properties it serialises
   * under its own alias take the name Chromium writes, and nothing else changes. Without an
   * engine, or in Chromium, no property is renamed.
   */
  engine?: BrowserEngine;
  /**
   * The DOM is a hydrated server render (L12, ADR-0095): the markup the server wrote for each
   * form control's first state is removed wherever its live state is serialised (rule 4f).
   */
  hydrated?: boolean;
}

/** Refuses a target the normaliser does not know, from an untyped caller. */
export function checkOptions(options: NormalizeOptions): void {
  if (options.target !== undefined && !isNormalizeTarget(options.target)) {
    throw new TypeError(`normalizeHtml: unknown target ${JSON.stringify(options.target)}`);
  }
  if (options.hydrated !== undefined && typeof options.hydrated !== "boolean") {
    throw new TypeError(
      `normalizeHtml: hydrated is a boolean, not ${JSON.stringify(options.hydrated)}`,
    );
  }
  if (options.engine !== undefined && !BROWSER_ENGINES.includes(options.engine)) {
    throw new TypeError(`normalizeHtml: unknown engine ${JSON.stringify(options.engine)}`);
  }
}

/**
 * Runs the rules over a parsed fragment, in place, and prints it (see `normalizeHtml`). `ids`,
 * when given, receives the generated ids' renaming (see `canonicalizeGeneratedIds`).
 */
export function normalizeTree(
  root: TreeFragment,
  options: NormalizeOptions,
  ids?: Map<string, string>,
): string {
  checkOptions(options);
  const { target, engine } = options;
  removeComments(root);
  removeQwikStyles(root, target);
  // Before the attributes go: a container's scripts are told apart by theirs.
  unwrapQwikContainers(root, target);
  removeFrameworkAttributes(root, target);
  removeQwikTemplates(root, target);
  unwrapAngularHosts(root, target);
  renameEngineAliases(root, engine);
  canonicalizeStyles(root);
  canonicalizeBooleanAttributes(root);
  canonicalizeClasses(root);
  removeSettledValues(root);
  removeReactDefaultStates(root, target);
  removeServerControlStates(root, options.hydrated);
  sortAttributes(root);
  collapseWhitespace(root);
  canonicalizeGeneratedIds(root, ids);
  return printTree(root);
}
