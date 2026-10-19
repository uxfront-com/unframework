import type { NormalizeTarget } from "../targets.ts";

/** Two words that an Angular host's edge joins with no whitespace between them. */
export interface HostJoin {
  /** The word that ends at the host's edge. */
  before: string;
  /** The word that starts there. */
  after: string;
}

/**
 * The inline elements whose text Playwright's ARIA snapshot joins with their neighbours': they
 * have no role, so no node of their own. Any other element is a node of its own, or a box the
 * snapshot spaces on every target, so no host edge inside it is joined across it.
 */
const JOINING_TAGS = new Set([
  "abbr",
  "b",
  "bdi",
  "bdo",
  "cite",
  "data",
  "font",
  "i",
  "kbd",
  "label",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "u",
  "var",
]);

/** Where the text stops: at a box or a node of its own. */
const BREAK = 0;
/** Where a host starts or ends. */
const EDGE = 1;

/**
 * The host joins under `root`, in document order (ADR-0060). Playwright's ARIA snapshot puts a
 * space at the start and the end of every element whose `display` isn't `inline`, and Angular's
 * host is `display: contents` (ADR-0010), so two components rendered side by side as inline
 * content read "Build passing" where every other target reads "Buildpassing". A join is a host
 * edge with a word on each side and no whitespace between them, inside one run of text: the live
 * DOM's computed styles say which elements are inline, which Playwright's string alone cannot.
 */
export function hostJoins(root: Element): HostJoin[] {
  const tokens: (string | typeof BREAK | typeof EDGE)[] = [];
  const visit = (node: Node): void => {
    if (node.nodeType === 3) {
      tokens.push(node.textContent ?? "");
      return;
    }
    if (!(node instanceof Element)) return;
    const style = getComputedStyle(node);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      node.getAttribute("aria-hidden") === "true"
    ) {
      return;
    }
    const host = node.localName.startsWith("uf-") && style.display === "contents";
    const joining =
      style.display === "inline" && JOINING_TAGS.has(node.localName) && !node.hasAttribute("role");
    const mark = host ? EDGE : joining ? undefined : BREAK;
    if (mark !== undefined) tokens.push(mark);
    for (const child of node.childNodes) visit(child);
    if (mark !== undefined) tokens.push(mark);
  };
  for (const child of root.childNodes) visit(child);

  // Each word, split at the host edges inside it: two pieces side by side make a join.
  const joins: HostJoin[] = [];
  let pieces = [""];
  const endWord = () => {
    const words = pieces.filter(Boolean);
    for (let index = 1; index < words.length; index += 1) {
      joins.push({ before: words[index - 1]!, after: words[index]! });
    }
    pieces = [""];
  };
  for (const token of tokens) {
    if (token === BREAK) endWord();
    else if (token === EDGE) {
      if (pieces.at(-1)) pieces.push("");
    } else {
      for (const character of token) {
        if (/\s/.test(character)) endWord();
        else pieces[pieces.length - 1] += character;
      }
    }
  }
  endWord();
  return joins;
}

/**
 * The ARIA snapshot rule: on Angular only, removes the space Playwright's ARIA snapshot puts at
 * each host join (`hostJoins`, ADR-0060), and no other. The joins come in document order, as the
 * snapshot's text does: each removes the space in the first `before after` from where the
 * previous one's word after starts, so a space the source writes between the same two words
 * elsewhere stays. A join the snapshot does not show (a word the snapshot quotes or splits)
 * removes nothing, and the difference stays visible.
 */
export function removeHostSpaces(
  snapshot: string,
  joins: readonly HostJoin[],
  target?: NormalizeTarget,
): string {
  if (target !== "angular") return snapshot;
  let text = snapshot;
  let cursor = 0;
  for (const { before, after } of joins) {
    const at = text.indexOf(`${before} ${after}`, cursor);
    if (at < 0) continue;
    const space = at + before.length;
    text = text.slice(0, space) + text.slice(space + 1);
    cursor = space;
  }
  return text;
}
