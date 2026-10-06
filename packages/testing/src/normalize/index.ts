// The normaliser of plan §7.5: it turns HTML from any target, server-rendered or serialised
// from the live DOM, into one canonical text, so that output which renders the same compares
// equal and anything else stays different. It removes framework noise only; each rule is a
// function of its own under `rules/`, with tests proving it keeps real differences.
//
// It runs in Node and in the browser (parse5 is its only dependency).
import { checkOptions, normalizeTree } from "./pipeline.ts";
import type { NormalizeOptions } from "./pipeline.ts";
import { parseHtml } from "./tree.ts";

export type { NormalizeOptions } from "./pipeline.ts";
export { isNormalizeTarget, NORMALIZE_TARGETS } from "./targets.ts";
export type { NormalizeTarget } from "./targets.ts";

/**
 * Normalises an HTML fragment (a component's server HTML, or `serializeDom` of a mount
 * container) into the canonical text of `print.ts`: one node per line, attributes sorted,
 * text quoted.
 *
 * The HTML is parsed as `innerHTML` of an element in `<body>`, and markup the parser would
 * have to repair (a duplicate attribute, a stray end tag, a table part outside a table, a
 * document shell) throws, because normalising the repaired tree would hide it. The rules run
 * in the order their numbers give:
 *
 * 1. comments are removed (`removeComments`);
 * 2. attributes the target's framework adds are removed (`removeFrameworkAttributes`);
 * 3. Angular's `uf-*` host elements with `display: contents` are unwrapped
 *    (`unwrapAngularHosts`);
 * 4. style declarations (4a, `canonicalizeStyles`), boolean attributes (4b,
 *    `canonicalizeBooleanAttributes`) and class tokens (4c, `canonicalizeClasses`) get one
 *    canonical form, and a `class` or `style` that holds nothing goes;
 * 5. attributes are sorted by name (`sortAttributes`), before ids are numbered, so the
 *    numbering never depends on a framework's attribute order;
 * 6. whitespace collapses as the browser renders it (`collapseWhitespace`);
 * 7. generated ids become `uf-id-1`, `uf-id-2`… (`canonicalizeGeneratedIds`).
 */
export function normalizeHtml(html: string, options: NormalizeOptions = {}): string {
  checkOptions(options);
  return normalizeTree(parseHtml(html), options);
}
