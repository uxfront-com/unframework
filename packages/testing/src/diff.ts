// A small line diff for failure messages. Layer failures are recorded as text (the parity matrix
// and the combined test error), so they carry their own diff instead of relying on a reporter
// to render `expected`/`actual`. Isomorphic and dependency-free.

/** Options for {@link diffLines}. */
export interface DiffOptions {
  /** Unchanged lines shown around each change. */
  context?: number;
  /** The most diff lines printed before the rest is summarised. */
  maxLines?: number;
}

/** Above this many cells the LCS table is too large; the diff falls back to the first change. */
const MAX_CELLS = 4_000_000;

/**
 * A unified-style diff from `expected` to `actual`: `-` lines are expected, `+` lines are
 * actual. Returns an empty string when the texts are equal.
 */
export function diffLines(expected: string, actual: string, options: DiffOptions = {}): string {
  if (expected === actual) return "";
  const context = options.context ?? 3;
  const maxLines = options.maxLines ?? 80;
  const a = expected.split("\n");
  const b = actual.split("\n");
  const ops = a.length * b.length > MAX_CELLS ? firstChange(a, b) : lcsOps(a, b);

  const lines: string[] = [];
  let lastPrinted = -1;
  const changed = ops.map((op) => op.kind !== " ");
  for (let index = 0; index < ops.length; index += 1) {
    const near = changed
      .slice(Math.max(0, index - context), index + context + 1)
      .some((isChange) => isChange);
    if (!near) continue;
    if (lastPrinted !== -1 && index > lastPrinted + 1) lines.push("  …");
    const op = ops[index]!;
    lines.push(`${op.kind} ${visible(op.text)}`);
    lastPrinted = index;
  }
  const shown =
    lines.length > maxLines
      ? [...lines.slice(0, maxLines), `  … ${lines.length - maxLines} more diff line(s)`]
      : lines;
  return ["- expected", "+ actual", ...shown].join("\n");
}

interface Op {
  kind: " " | "-" | "+";
  text: string;
}

function lcsOps(a: readonly string[], b: readonly string[]): Op[] {
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + j + 1]! + 1
          : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ kind: " ", text: a[i]! });
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) {
      ops.push({ kind: "-", text: a[i]! });
      i += 1;
    } else {
      ops.push({ kind: "+", text: b[j]! });
      j += 1;
    }
  }
  while (i < a.length) ops.push({ kind: "-", text: a[i++]! });
  while (j < b.length) ops.push({ kind: "+", text: b[j++]! });
  return ops;
}

/** For very large inputs: everything up to the first differing line is shared, the rest differs. */
function firstChange(a: readonly string[], b: readonly string[]): Op[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  return [
    ...a.slice(0, start).map((text): Op => ({ kind: " ", text })),
    ...a.slice(start).map((text): Op => ({ kind: "-", text })),
    ...b.slice(start).map((text): Op => ({ kind: "+", text })),
  ];
}

/** Makes trailing whitespace and carriage returns visible, since they are often the difference. */
function visible(text: string): string {
  return text.replace(/\r/g, "\\r").replace(/[ \t]+$/, (spaces) => spaces.replace(/ /g, "·"));
}
