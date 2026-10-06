// How a framework splits one run of text into DOM text nodes is its own noise (ADR-0044): React,
// Solid and Qwik write `Price: {price} EUR` as three nodes where Vue writes one, and Vue splits a
// text branch from the text beside it. L7 serialises a run as one text already. Chromium lays out
// each node's width in 1/64 px units and starts the next node at the rounded edge, so the glyphs
// after a split shift by a fraction of a pixel and rasterise differently; L10 would report that
// artefact, not the component. So the capture merges every run into one node, and restores it.
// No imports: a target's own tests use it to prove their framework survives a capture.

/** One merged run: its first text node, what it held, and the nodes taken out after it. */
interface MergedRun {
  first: Text;
  data: string;
  detached: ChildNode[];
}

/** Elements whose text is not laid out as text: raw text, and a form control's value. */
const SKIPPED = new Set(["script", "style", "textarea"]);

/**
 * Merges every run of adjacent text nodes under `root` into the run's first text node: text
 * nodes count as adjacent when only comment nodes (framework anchors) separate them. The first
 * node's data becomes the run's text; the other text nodes and the comments between them are
 * detached, and kept. Runs never cross an element, so white-space processing, which works on an
 * element's text whatever its nodes, is unchanged. Returns what restores the tree exactly: the
 * original data, and the same node objects back in their places, so a framework's references to
 * its nodes stay valid.
 */
export function mergeTextRuns(root: Element): () => void {
  const runs: MergedRun[] = [];
  const visit = (parent: Node): void => {
    let child = parent.firstChild;
    while (child) {
      if (child instanceof Text) {
        const run = runFrom(child);
        if (run.detached.length) {
          runs.push(run);
          child.data = [run.data, ...run.detached.map(textOf)].join("");
          for (const node of run.detached) node.remove();
        }
      } else if (child instanceof Element && !SKIPPED.has(child.localName)) {
        visit(child);
      }
      child = child.nextSibling;
    }
  };
  visit(root);
  return () => {
    for (const { first, data, detached } of runs.toReversed()) {
      first.data = data;
      first.after(...detached);
    }
  };
}

/** Runs `capture` with the text runs under `root` merged, and restores them afterwards. */
export async function withMergedTextRuns<T>(root: Element, capture: () => Promise<T>): Promise<T> {
  const restore = mergeTextRuns(root);
  try {
    return await capture();
  } finally {
    restore();
  }
}

/** The run starting at `first`: the nodes after it up to its last adjacent text node. */
function runFrom(first: Text): MergedRun {
  const detached: ChildNode[] = [];
  const pending: ChildNode[] = [];
  for (let node = first.nextSibling; node; node = node.nextSibling) {
    if (node instanceof Comment) {
      pending.push(node);
    } else if (node instanceof Text) {
      detached.push(...pending.splice(0), node);
    } else {
      break;
    }
  }
  return { first, data: first.data, detached };
}

/** The text a detached node adds to its run: a text node's data, nothing for a comment. */
function textOf(node: ChildNode): string {
  return node instanceof Text ? node.data : "";
}
