// Source maps (plan §5.8, §7.2 L14, ADR-0074). No printer keeps a position, so a map is found after
// the fact: IR code keeps its source text and the rewrite engine splices only its references
// (ADR-0035), so the text between them reaches the output as written. Formatting returns no map, so
// each position is then carried across by a diff. A position this can't show stays unmapped: a
// frame that lands there resolves no better than the nearest segment, which beats a wrong line (P2).
import { addSegment, GenMapping, setSourceContent, toEncodedMap } from "@jridgewell/gen-mapping";
import { decodedMappings, TraceMap } from "@jridgewell/trace-mapping";
import { createDiagnostic } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";
import type { CodeReference, Span, UfModule } from "@unframework/ir";

import { codeBlocks, isFormatted } from "./format.ts";
import type { OutputFile, SourceMapV3 } from "./target.ts";

/** What {@link remapFormatted} gives: the moved map, or UF9002 instead of one. */
export type RemapResult = { map: SourceMapV3 } | { diagnostic: Diagnostic };

/**
 * A token of a literal run: a word or a number whole, any other character alone, so a string's
 * quotes are tokens of their own and survive oxfmt's rewriting of them apart from its text.
 */
const TOKEN = /[\p{ID_Start}$_][\p{ID_Continue}$]*|\d[\w.]*|\S/uy;
const TOKENS = new RegExp(TOKEN.source, "gu");
const IDENTIFIER = /[\p{ID_Start}$_][\p{ID_Continue}$]*/uy;
const WORD_CHARACTER = /[\p{ID_Continue}$]/u;
/** What makes a run worth finding: punctuation alone, like `);`, matches anywhere. */
const HAS_WORD = /[\p{L}\p{N}_$]/u;
const WORD_CHARACTERS = /[\p{L}\p{N}_$]/gu;
const IDENTIFIERS = new RegExp(IDENTIFIER.source, "gu");
/** What a target's spelling of a reference is made of, which binds as tightly as a member. */
const SPELLING = /[\p{ID_Continue}$.()!?]/u;
/** A run with this many word characters is text a target hardly writes on its own. */
const DISTINCTIVE = 8;

/** A literal run of a `Code`, trimmed to one source line, since printers re-indent code. */
interface Run {
  start: number;
  text: string;
  /** The `Code` it comes from, and its place among that `Code`'s runs. */
  owner: Owner;
  index: number;
  /** The references right before and right after it, whose spelling must sit beside it. */
  before?: CodeReference;
  after?: CodeReference;
  /** Where the output holds it, once found. */
  at?: number;
}

/** A piece of IR code with text of its own. */
interface Owner {
  runs: Run[];
  refs: readonly CodeReference[];
}

/** A map position, with the name of the reference it starts. */
interface Anchor {
  generated: number;
  original: number;
  name?: string;
}

/**
 * Maps the code an output copies from its source: each IR `Code` of `module` is split at its
 * references into literal runs, found in the output longest first and in source order, never
 * overlapping. A segment marks each token of a run and the start of each reference beside one.
 * A `Code` made only of references stays unmapped. So does a `.css` sheet, which holds no `Code`.
 * Pass a module holding only the component the file is written for, so that another component's
 * identical text can't claim the place.
 */
export function anchorOutput(file: OutputFile, module: UfModule, source: string): OutputFile {
  const anchors = file.path.endsWith(".css") ? [] : findAnchors(file.contents, module, source);
  const map = buildMap(
    file.path,
    sourceName(file.path, module.file),
    source,
    file.contents,
    anchors,
  );
  return { ...file, map };
}

/** A file copied unchanged, a shared module's (ADR-0070), mapped token by token onto itself. */
export function identityMapped(file: OutputFile): OutputFile {
  const anchors: Anchor[] = [];
  for (const match of file.contents.matchAll(TOKENS)) {
    anchors.push({ generated: match.index, original: match.index });
  }
  const name = file.path.slice(file.path.lastIndexOf("/") + 1);
  return { ...file, map: buildMap(file.path, name, file.contents, file.contents, anchors) };
}

/**
 * Moves a map across formatting by a diff over the non-whitespace characters: of a whole code
 * file, and in a markup file of each script block or frontmatter (ADR-0041), around markup that
 * keeps its bytes. A segment survives where its token is unchanged, so the text it maps stays
 * identical to its source (L14): a string's rewritten quotes and a number's rewritten form lose
 * theirs. When fewer than 95% of the file's characters match, it returns UF9002 instead of a map.
 * Quotes don't count: oxfmt drops them around an object's keys, so a table of quoted keys is no
 * sign of a failed diff. What formatting adds doesn't count either, or code without semicolons fails.
 */
export function remapFormatted(
  before: OutputFile,
  after: OutputFile,
  map: SourceMapV3,
): RemapResult {
  const moved = moveOffsets(before.path, before.contents, after.contents);
  if (typeof moved === "string") {
    return {
      diagnostic: createDiagnostic("UF9002", {
        file: map.sources[0]!,
        span: { start: 0, end: 0 },
        message: `The map of ${before.path} could not follow formatting: ${moved}.`,
      }),
    };
  }
  const beforeLines = lineStarts(before.contents);
  const afterLines = lineStarts(after.contents);
  const generated = new GenMapping({ file: map.file });
  const name = map.sources[0]!;
  setSourceContent(generated, name, map.sourcesContent[0]!);
  const lines = decodedMappings(new TraceMap(map));
  for (const [line, segments] of lines.entries()) {
    for (const segment of segments) {
      const offset = beforeLines[line]! + segment[0];
      const target = moved[offset]!;
      if (target < 0 || segment.length === 1) continue;
      const token = tokenAt(before.contents, offset);
      if (!after.contents.startsWith(token, target)) continue;
      const position = positionOf(afterLines, target);
      const label = segment.length === 5 ? map.names[segment[4]] : undefined;
      if (label === undefined) {
        addSegment(generated, position.line, position.column, name, segment[2], segment[3]);
      } else {
        addSegment(generated, position.line, position.column, name, segment[2], segment[3], label);
      }
    }
  }
  return { map: encode(generated, map.file) };
}

/** The offset each character of `before` moved to, or -1, or why the diff failed. */
function moveOffsets(path: string, before: string, after: string): Int32Array | string {
  const moved = new Int32Array(before.length).fill(-1);
  const total = countedCharacters(before);
  const count: MatchCount = { total, spare: total - Math.ceil(total * MATCH_THRESHOLD) };
  const tooFew = `fewer than 95% of its ${total} characters match`;
  if (isFormatted(path)) {
    const whole = diffInto(moved, before, 0, before.length, after, 0, after.length, count);
    return whole ? moved : tooFew;
  }
  let beforeBlocks: Span[];
  let afterBlocks: Span[];
  try {
    beforeBlocks = codeBlocks(path, before);
    afterBlocks = codeBlocks(path, after);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  if (beforeBlocks.length !== afterBlocks.length) {
    return `its ${beforeBlocks.length} code blocks became ${afterBlocks.length}`;
  }
  let beforeAt = 0;
  let afterAt = 0;
  for (const [index, block] of beforeBlocks.entries()) {
    const formatted = afterBlocks[index]!;
    if (!keptInto(moved, before, beforeAt, block.start, after, afterAt, formatted.start)) {
      return "the markup around a code block changed";
    }
    if (
      !diffInto(moved, before, block.start, block.end, after, formatted.start, formatted.end, count)
    ) {
      return tooFew;
    }
    beforeAt = block.end;
    afterAt = formatted.end;
  }
  if (!keptInto(moved, before, beforeAt, before.length, after, afterAt, after.length)) {
    return "the markup around a code block changed";
  }
  return moved;
}

const MATCH_THRESHOLD = 0.95;

/** The file's counted characters, and how many of them formatting may still drop. */
interface MatchCount {
  total: number;
  spare: number;
}

/** The characters the threshold counts: neither whitespace nor quotes. */
function countedCharacters(text: string): number {
  let total = 0;
  for (let offset = 0; offset < text.length; offset++) {
    const code = text.charCodeAt(offset);
    if (!isSpace(code) && code !== DOUBLE_QUOTE && code !== SINGLE_QUOTE) total++;
  }
  return total;
}

/** Moves markup that formatting keeps byte for byte, but for the whitespace ending the file. */
function keptInto(
  moved: Int32Array,
  before: string,
  beforeStart: number,
  beforeEnd: number,
  after: string,
  afterStart: number,
  afterEnd: number,
): boolean {
  const kept = before.slice(beforeStart, beforeEnd).trimEnd();
  if (kept !== after.slice(afterStart, afterEnd).trimEnd()) return false;
  for (let offset = 0; offset < kept.length; offset++) {
    moved[beforeStart + offset] = afterStart + offset;
  }
  return true;
}

/**
 * Diffs one range of code over its non-whitespace characters and moves those that match. Returns
 * `false` once the file has lost more characters than the threshold allows.
 */
function diffInto(
  moved: Int32Array,
  before: string,
  beforeStart: number,
  beforeEnd: number,
  after: string,
  afterStart: number,
  afterEnd: number,
  count: MatchCount,
): boolean {
  const a = significant(before, beforeStart, beforeEnd);
  const b = significant(after, afterStart, afterEnd);
  const quotes = a.codes.filter((code) => code === DOUBLE_QUOTE).length;
  // An edit drops a character of `a` or adds one of `b`, and only the drops count. A diff that
  // drops `x` makes `2x + (b - a)` edits, which caps how far the search needs to go.
  const budget = 2 * (count.spare + quotes) + (b.codes.length - a.codes.length);
  const pairs = myers(a.codes, b.codes, budget);
  if (!pairs) return false;
  for (let index = 0; index < pairs.length; index++) {
    const match = pairs[index]!;
    if (match >= 0) moved[a.offsets[index]!] = b.offsets[match]!;
    else if (a.codes[index] !== DOUBLE_QUOTE) count.spare--;
  }
  return count.spare >= 0;
}

const DOUBLE_QUOTE = 0x22;
const SINGLE_QUOTE = 0x27;

/**
 * A range's non-whitespace characters and each one's offset. It reads what oxfmt rewrites in place
 * as the same character, `'` as `"` and a number's `E` as `e`, so a rewrite never costs the threshold,
 * and each token's own check still drops what changed.
 */
function significant(
  text: string,
  start: number,
  end: number,
): { codes: Uint16Array; offsets: Int32Array } {
  const codes = new Uint16Array(end - start);
  const offsets = new Int32Array(end - start);
  let length = 0;
  for (let offset = start; offset < end; offset++) {
    const code = text.charCodeAt(offset);
    if (isSpace(code)) continue;
    codes[length] = code === SINGLE_QUOTE ? DOUBLE_QUOTE : isUpperCase(code) ? code + 0x20 : code;
    offsets[length++] = offset;
  }
  return { codes: codes.subarray(0, length), offsets: offsets.subarray(0, length) };
}

function isUpperCase(code: number): boolean {
  return code >= 0x41 && code <= 0x5a;
}

/** Whether a UTF-16 code unit is whitespace, as `\s` reads it. */
function isSpace(code: number): boolean {
  return code <= 0x20
    ? code === 0x20 || (code >= 0x09 && code <= 0x0d)
    : code >= 0xa0 && /\s/.test(String.fromCharCode(code));
}

/**
 * Myers' diff: for each item of `a`, the index of the item of `b` it matches, or -1. `undefined`
 * when it takes more than `budget` edits.
 */
function myers(a: Uint16Array, b: Uint16Array, budget: number): Int32Array | undefined {
  const pairs = new Int32Array(a.length).fill(-1);
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    pairs[prefix] = prefix;
    prefix++;
  }
  let aEnd = a.length;
  let bEnd = b.length;
  while (aEnd > prefix && bEnd > prefix && a[aEnd - 1] === b[bEnd - 1]) {
    pairs[--aEnd] = --bEnd;
  }
  const n = aEnd - prefix;
  const m = bEnd - prefix;
  if (n === 0 && m === 0) return pairs;
  const limit = Math.min(budget, n + m);
  if (limit < Math.abs(n - m)) return undefined;
  // `furthest[k + offset]` is how far along `a` the diagonal `k` reaches.
  const offset = limit + 1;
  const furthest = new Int32Array(2 * limit + 3).fill(-1);
  furthest[offset + 1] = 0;
  const trace: Int32Array[] = [];
  for (let edits = 0; edits <= limit; edits++) {
    // Only the diagonals this round can read, so memory grows with the edits, not the limit.
    trace.push(furthest.slice(offset - edits - 1, offset + edits + 2));
    for (let k = -edits; k <= edits; k += 2) {
      if (k < -m || k > n) continue;
      const down =
        k === -edits || (k !== edits && furthest[offset + k - 1]! < furthest[offset + k + 1]!);
      let x = down ? furthest[offset + k + 1]! : furthest[offset + k - 1]! + 1;
      if (x < 0) continue;
      let y = x - k;
      if (x > n || y > m || y < 0) continue;
      while (x < n && y < m && a[prefix + x] === b[prefix + y]) {
        x++;
        y++;
      }
      furthest[offset + k] = x;
      if (x >= n && y >= m) {
        walkBack(pairs, trace, prefix, n, m);
        return pairs;
      }
    }
  }
  return undefined;
}

/** Follows the trace back from the end of the diff, recording every match. */
function walkBack(
  pairs: Int32Array,
  trace: readonly Int32Array[],
  prefix: number,
  n: number,
  m: number,
): void {
  let x = n;
  let y = m;
  for (let edits = trace.length - 1; edits >= 0; edits--) {
    const furthest = trace[edits]!;
    const offset = edits + 1;
    const k = x - y;
    const down =
      k === -edits || (k !== edits && furthest[offset + k - 1]! < furthest[offset + k + 1]!);
    const previous = down ? k + 1 : k - 1;
    const startX = edits === 0 ? 0 : furthest[offset + previous]!;
    const snakeX = edits === 0 ? 0 : down ? startX : startX + 1;
    while (x > snakeX && y > snakeX - k) {
      x--;
      y--;
      pairs[prefix + x] = prefix + y;
    }
    if (edits === 0) return;
    x = startX;
    y = startX - previous;
  }
}

/** Every position an output's text shows, from each `Code` of the module. */
function findAnchors(output: string, module: UfModule, source: string): Anchor[] {
  const owners = collectOwners(module, source);
  const runs = owners
    .flatMap((owner) => owner.runs)
    .toSorted((a, b) => b.text.length - a.text.length || a.start - b.start);
  const taken = new Uint8Array(output.length);
  const read = new Uint8Array(source.length);
  const remaining = new Map<string, number>();
  for (const { text } of runs) remaining.set(text, (remaining.get(text) ?? 0) + 1);
  for (const run of runs) {
    const same = remaining.get(run.text)!;
    remaining.set(run.text, same - 1);
    if (isTaken(read, run.start, run.start + run.text.length)) continue;
    // A run beside a reference is checked by it. Nothing checks any other run, so a short one needs
    // the output to hold as many places as the source holds runs, or it would be a guess (P2).
    if (
      !run.before &&
      !run.after &&
      (run.text.match(WORD_CHARACTERS) ?? []).length < DISTINCTIVE &&
      countFree(output, run.text, taken) !== same
    ) {
      continue;
    }
    // The runs of one `Code` keep their order: a run belongs between its neighbours.
    const { runs: siblings } = run.owner;
    let from = 0;
    for (let index = run.index - 1; index >= 0; index--) {
      const sibling = siblings[index]!;
      if (sibling.at !== undefined) {
        from = sibling.at + sibling.text.length;
        break;
      }
    }
    let to = output.length;
    for (let index = run.index + 1; index < siblings.length; index++) {
      const sibling = siblings[index]!;
      if (sibling.at !== undefined) {
        to = sibling.at;
        break;
      }
    }
    const at = findRun(output, run, from, to, taken, source);
    if (at < 0) continue;
    run.at = at;
    taken.fill(1, at, at + run.text.length);
    read.fill(1, run.start, run.start + run.text.length);
  }
  const anchors: Anchor[] = [];
  for (const owner of owners) {
    for (const run of owner.runs) {
      if (run.at === undefined) continue;
      for (const match of run.text.matchAll(TOKENS)) {
        anchors.push({ generated: run.at + match.index, original: run.start + match.index });
      }
    }
    for (const ref of owner.refs) {
      const generated = referenceStart(ref, owner.runs, output, source);
      const name = identifierAt(source, ref.span.start);
      if (generated !== undefined && name !== undefined) {
        anchors.push({ generated, original: ref.span.start, name });
      }
    }
  }
  return anchors;
}

/**
 * Where the output prints a reference, which only its neighbours show, since a target respells it:
 * right after the run before it, or, where the reference is spelled as written, right before the
 * run after it.
 */
function referenceStart(
  ref: CodeReference,
  runs: readonly Run[],
  output: string,
  source: string,
): number | undefined {
  for (const run of runs) {
    if (run.at === undefined) continue;
    const end = run.start + run.text.length;
    if (end > ref.span.start) break;
    if (source.slice(end, ref.span.start).trim()) continue;
    let at = run.at + run.text.length;
    while (at < output.length && isSpace(output.charCodeAt(at))) at++;
    return mentions(spellingAfter(output, at), ref, source) ? at : undefined;
  }
  const written = source.slice(ref.span.start, ref.span.end);
  for (const run of runs) {
    if (run.at === undefined || run.start < ref.span.end) continue;
    if (source.slice(ref.span.end, run.start).trim()) return undefined;
    let end = run.at;
    while (end > 0 && isSpace(output.charCodeAt(end - 1))) end--;
    const at = end - written.length;
    return at >= 0 && output.startsWith(written, at) && isWhole(output, at, end) ? at : undefined;
  }
  return undefined;
}

/** Each `Code` of the IR once with its literal runs, however the IR holds it. */
function collectOwners(module: UfModule, source: string): Owner[] {
  const owners = new Map<string, Owner>();
  const visit = (value: unknown): void => {
    if (typeof value !== "object" || value === null) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const { code, span, refs } = value as { code?: unknown; span?: Span; refs?: CodeReference[] };
    // An imported module's API holds spans of its own file: only this source's text counts.
    if (
      typeof code === "string" &&
      span &&
      source.slice(span.start, span.end) === code &&
      !owners.has(`${span.start}:${span.end}`)
    ) {
      const owner: Owner = { runs: [], refs: refs ?? [] };
      for (const run of literalRuns(span, owner.refs, source)) {
        const end = run.start + run.text.length;
        const beside = owner.refs.filter((ref) => ref.kind !== "Write" && ref.kind !== "Emit");
        const before = beside.find(
          ({ span: { end: refEnd } }) =>
            refEnd <= run.start && !source.slice(refEnd, run.start).trim(),
        );
        const after = beside.find(
          ({ span: { start } }) => start >= end && !source.slice(end, start).trim(),
        );
        owner.runs.push({
          ...run,
          owner,
          index: owner.runs.length,
          ...(before ? { before } : {}),
          ...(after ? { after } : {}),
        });
      }
      owners.set(`${span.start}:${span.end}`, owner);
    }
    for (const item of Object.values(value)) visit(item);
  };
  visit(module);
  return [...owners.values()];
}

/**
 * The text of a `Code` no reference covers, one piece per source line. A write's target and
 * operator, and an emit's call, go when a target replaces them whole; what they hold of the author's
 * text is a value's or an argument's, which stays literal.
 */
function literalRuns(
  span: Span,
  refs: readonly CodeReference[],
  source: string,
): { start: number; text: string }[] {
  const cuts: Span[] = [];
  for (const ref of refs) {
    if (ref.kind === "Write" || ref.kind === "Emit") {
      const kept = ref.kind === "Emit" ? ref.arguments : ref.value ? [ref.value] : [];
      let start = ref.span.start;
      for (const part of kept) {
        cuts.push({ start, end: part.start });
        start = part.end;
      }
      cuts.push({ start, end: ref.span.end });
    } else {
      cuts.push(ref.span);
    }
  }
  cuts.sort((a, b) => a.start - b.start);
  const runs: { start: number; text: string }[] = [];
  const add = (start: number, end: number) => {
    let at = start;
    for (const line of source.slice(start, end).split("\n")) {
      const text = line.trim();
      if (HAS_WORD.test(text)) {
        runs.push({ start: at + line.length - line.trimStart().length, text });
      }
      at += line.length + 1;
    }
  };
  let at = span.start;
  for (const cut of cuts) {
    if (cut.start > at) add(at, cut.start);
    at = Math.max(at, cut.end);
  }
  if (at < span.end) add(at, span.end);
  return runs;
}

/**
 * The first free place from `from` to `to` that holds the run as whole tokens, beside the spelling
 * of each reference next to it, or -1: `.map(` after `shelves` is no match in `books.map(`.
 */
function findRun(
  output: string,
  { text, before, after }: Run,
  from: number,
  to: number,
  taken: Uint8Array,
  source: string,
): number {
  for (let at = output.indexOf(text, from); at >= 0; at = output.indexOf(text, at + 1)) {
    const end = at + text.length;
    if (end > to) return -1;
    if (
      !isTaken(taken, at, end) &&
      isWhole(output, at, end) &&
      (!before || mentions(spellingBefore(output, at), before, source)) &&
      (!after || mentions(spellingAfter(output, end), after, source))
    ) {
      return at;
    }
  }
  return -1;
}

/** How many free places hold the text as whole tokens. */
function countFree(output: string, text: string, taken: Uint8Array): number {
  let count = 0;
  for (let at = output.indexOf(text); at >= 0; at = output.indexOf(text, at + 1)) {
    if (!isTaken(taken, at, at + text.length) && isWhole(output, at, at + text.length)) count++;
  }
  return count;
}

/** The spelling that ends at `end`, past any whitespace. */
function spellingBefore(output: string, end: number): string {
  let last = end;
  while (last > 0 && isSpace(output.charCodeAt(last - 1))) last--;
  let first = last;
  while (first > 0 && SPELLING.test(output[first - 1]!)) first--;
  return output.slice(first, last);
}

/** The spelling that starts at `start`, past any whitespace. */
function spellingAfter(output: string, start: number): string {
  let first = start;
  while (first < output.length && isSpace(output.charCodeAt(first))) first++;
  let last = first;
  while (last < output.length && SPELLING.test(output[last]!)) last++;
  return output.slice(first, last);
}

/**
 * Whether a spelling names a reference. Targets keep the name in what they print (`props.label`,
 * `count()`, `this.count()`). One that doesn't leaves the reference and its neighbours unmapped.
 */
function mentions(spelling: string, ref: CodeReference, source: string): boolean {
  const written =
    ref.kind === "Write"
      ? source.slice(ref.target.start, ref.target.end)
      : ref.kind === "Emit"
        ? (identifierAt(source, ref.span.start) ?? "")
        : source.slice(ref.span.start, ref.span.end);
  return (written.match(IDENTIFIERS) ?? []).some((name) => spelling.includes(name));
}

/** Whether a range starts and ends at token edges: `a` is no match inside `data`. */
function isWhole(text: string, start: number, end: number): boolean {
  const joins = (left: number) =>
    left >= 0 &&
    left + 1 < text.length &&
    WORD_CHARACTER.test(text[left]!) &&
    WORD_CHARACTER.test(text[left + 1]!);
  return !joins(start - 1) && !joins(end - 1);
}

function isTaken(taken: Uint8Array, start: number, end: number): boolean {
  for (let offset = start; offset < end; offset++) if (taken[offset]) return true;
  return false;
}

function tokenAt(text: string, offset: number): string {
  TOKEN.lastIndex = offset;
  return TOKEN.exec(text)?.[0] ?? "";
}

function identifierAt(text: string, offset: number): string | undefined {
  IDENTIFIER.lastIndex = offset;
  return IDENTIFIER.exec(text)?.[0];
}

/**
 * The source's name as `sources` holds it: relative to the output's directory, whose tree stands
 * where the source's directory does (ADR-0070), and never an absolute path (P8).
 */
function sourceName(path: string, file: string): string {
  return "../".repeat(path.split("/").length - 1) + file.slice(file.lastIndexOf("/") + 1);
}

function buildMap(
  path: string,
  name: string,
  source: string,
  output: string,
  anchors: readonly Anchor[],
): SourceMapV3 {
  const file = path.slice(path.lastIndexOf("/") + 1);
  const map = new GenMapping({ file });
  setSourceContent(map, name, source);
  const generated = lineStarts(output);
  const original = lineStarts(source);
  for (const anchor of anchors) {
    const to = positionOf(generated, anchor.generated);
    const from = positionOf(original, anchor.original);
    if (anchor.name === undefined) {
      addSegment(map, to.line, to.column, name, from.line, from.column);
    } else {
      addSegment(map, to.line, to.column, name, from.line, from.column, anchor.name);
    }
  }
  return encode(map, file);
}

function encode(map: GenMapping, file: string): SourceMapV3 {
  const { sources, sourcesContent, names, mappings } = toEncodedMap(map);
  return {
    version: 3,
    file,
    sources: sources as string[],
    sourcesContent: sourcesContent as string[],
    names: [...names],
    mappings,
  };
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let at = text.indexOf("\n"); at >= 0; at = text.indexOf("\n", at + 1)) starts.push(at + 1);
  return starts;
}

function positionOf(starts: readonly number[], offset: number): { line: number; column: number } {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (starts[middle]! <= offset) low = middle;
    else high = middle - 1;
  }
  return { line: low, column: offset - starts[low]! };
}
