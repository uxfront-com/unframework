// Source maps (plan §5.8, §7.2 L14, ADR-0074). No printer keeps a position, so a map is found after
// the fact: IR code keeps its source text and the rewrite engine splices only its references
// (ADR-0035), so the text between them reaches the output as written. Formatting returns no map, so
// each position is then carried across by a diff. A position this can't show stays unmapped: a
// frame that lands there resolves no better than the nearest segment, which beats a wrong line (P2).
import { addSegment, GenMapping, setSourceContent, toEncodedMap } from "@jridgewell/gen-mapping";
import remapping from "@jridgewell/remapping";
import { decodedMappings, TraceMap } from "@jridgewell/trace-mapping";
import { createDiagnostic } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";
import type { CodeReference, Span, UfModule } from "@unframework/ir";

import { codeBlocks, isFormatted } from "./format.ts";
import type { OutputFile, SourceMapV3 } from "./target.ts";

/** What {@link remapFormatted} gives: the moved map, or UF9002 or UF9003 instead of one. */
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
/**
 * What the threshold counts: words, the group here. It passes over a number, whose form oxfmt
 * rewrites (`1e0` to `1`), and a `/` with the lowercase letters after it: a regular expression's
 * flags, which it sorts, and so also a lowercase closing tag's name or a path's segment.
 */
const COUNTED = /\d[\p{ID_Continue}.]*|\/[a-z]+\b|([\p{ID_Start}$_][\p{ID_Continue}$]*)/gu;
const BRACES = /[{}]/;
const IDENTIFIERS = new RegExp(IDENTIFIER.source, "gu");
/** What a target's spelling of a reference is made of, which binds as tightly as a member. */
const SPELLING = /[\p{ID_Continue}$.()!?]/u;
/** A run with this many word characters is text a target hardly writes on its own. */
const DISTINCTIVE = 8;
/**
 * The bytes a diff's trace may hold. The trace grows with the square of the edits, so a table of
 * numbers oxfmt rewrites one by one reaches gigabytes (ADR-0074). This is about 8,000 edits, far
 * beyond what a component's formatting makes.
 */
const MAX_TRACE_BYTES = 256 * 1024 * 1024;
/** A diff that gave up at {@link MAX_TRACE_BYTES}, which says nothing about how much would match. */
const PAST_CAP = Symbol("past the cap");

/** A piece of a `Code`'s text, and where the source holds it. */
interface Piece {
  start: number;
  text: string;
}

/**
 * A literal run of a `Code`, trimmed to one source line, since printers re-indent code, or to a piece
 * of that line between braces, where the output doesn't hold it whole.
 */
interface Run extends Piece {
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
 * theirs. When fewer than 95% of the file's words match, it returns UF9002 instead of a map. Only
 * words count: oxfmt removes punctuation (a redundant parenthesis, a quote around a key, an escape's
 * backslash) and rewrites a number's form, and an ordinary small component can lose more than 5% of
 * its text that way. It rarely changes a word, but it does in `title="don&apos;t"`, so a target or a
 * plugin that prints such text can reach UF9002. A diff past {@link MAX_TRACE_BYTES} returns the
 * warning UF9003 instead, since the source is valid and the output only goes without a map.
 */
export function remapFormatted(
  before: OutputFile,
  after: OutputFile,
  map: SourceMapV3,
): RemapResult {
  const moved = moveOffsets(before.path, before.contents, after.contents);
  if (moved === PAST_CAP) {
    return {
      diagnostic: createDiagnostic("UF9003", {
        file: map.sources[0]!,
        span: { start: 0, end: 0 },
        message: `${before.path} has no source map: formatting changed it too much to diff in 256 MB. The file still works.`,
      }),
    };
  }
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

/** The offset each character of `before` moved to, or -1, or why the diff failed or gave up. */
function moveOffsets(
  path: string,
  before: string,
  after: string,
): Int32Array | string | typeof PAST_CAP {
  const moved = new Int32Array(before.length).fill(-1);
  const total = countedText(before).length;
  // At least 95% match where at most one in twenty goes, in whole numbers, so no rounding decides.
  const count: MatchCount = { spare: Math.floor(total / 20) };
  const tooFew = `fewer than 95% of the ${total} word characters it counts match`;
  if (isFormatted(path)) {
    const whole = diffInto(moved, before, 0, before.length, after, 0, after.length, count);
    if (whole === PAST_CAP) return PAST_CAP;
    return whole ? moved : tooFew;
  }
  let beforeBlocks: Span[];
  let afterBlocks: Span[];
  try {
    beforeBlocks = codeBlocks(path, before);
    afterBlocks = codeBlocks(path, after);
  } catch (error) {
    return (error instanceof Error ? error.message : String(error)).replace(/\.$/, "");
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
    const diffed = diffInto(
      moved,
      before,
      block.start,
      block.end,
      after,
      formatted.start,
      formatted.end,
      count,
    );
    if (diffed === PAST_CAP) return PAST_CAP;
    if (!diffed) return tooFew;
    beforeAt = block.end;
    afterAt = formatted.end;
  }
  if (!keptInto(moved, before, beforeAt, before.length, after, afterAt, after.length)) {
    return "the markup around a code block changed";
  }
  return moved;
}

/** How many of the file's counted characters formatting may still drop. */
interface MatchCount {
  spare: number;
}

function countedText(text: string): string {
  let words = "";
  for (const [, word] of text.matchAll(COUNTED)) if (word) words += word;
  return words;
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
 * `false` once the file has lost more characters than the threshold allows, or {@link PAST_CAP}.
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
): boolean | typeof PAST_CAP {
  const a = significant(before, beforeStart, beforeEnd);
  const b = significant(after, afterStart, afterEnd);
  // The counted characters first, on their own: a file that can't reach the threshold stops here,
  // and the edits a diff of `x` drops makes, `2x + (b - a)`, cap the search at exactly what's left.
  const wordsA = codesOf(countedText(before.slice(beforeStart, beforeEnd)));
  const wordsB = codesOf(countedText(after.slice(afterStart, afterEnd)));
  const words = myers(wordsA, wordsB, 2 * count.spare + (wordsB.length - wordsA.length));
  if (!words) return false;
  if (words === PAST_CAP) return PAST_CAP;
  for (const match of words) if (match < 0) count.spare--;
  const pairs = myers(a.codes, b.codes, a.codes.length + b.codes.length)!;
  if (pairs === PAST_CAP) return PAST_CAP;
  for (let index = 0; index < pairs.length; index++) {
    const match = pairs[index]!;
    if (match >= 0) moved[a.offsets[index]!] = b.offsets[match]!;
  }
  return true;
}

const DOUBLE_QUOTE = 0x22;
const SINGLE_QUOTE = 0x27;

function codesOf(text: string): Uint16Array {
  return Uint16Array.from({ length: text.length }, (_, index) => text.charCodeAt(index));
}

/**
 * A range's non-whitespace characters and each one's offset. It reads what oxfmt rewrites in place
 * as the same character, `'` as `"` and a number's `E` as `e`, so a rewrite still lines up, and each
 * token's own check then drops what changed.
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
 * when it takes more than `budget` edits, {@link PAST_CAP} when its trace outgrows the cap first.
 */
function myers(
  a: Uint16Array,
  b: Uint16Array,
  budget: number,
): Int32Array | undefined | typeof PAST_CAP {
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
  let traced = 0;
  for (let edits = 0; edits <= limit; edits++) {
    traced += (2 * edits + 3) * Int32Array.BYTES_PER_ELEMENT;
    if (traced > MAX_TRACE_BYTES) return PAST_CAP;
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
  const taken = new Uint8Array(output.length);
  const read = new Uint8Array(source.length);
  const place = (unplaced: readonly Run[]): void => {
    const runs = unplaced.toSorted((a, b) => b.text.length - a.text.length || a.start - b.start);
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
        !isDistinctive(run.text) &&
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
  };
  place(owners.flatMap((owner) => owner.runs));
  // Whole lines take their places first, since a piece is short and often like another. Only a line
  // the output doesn't hold is tried again between its braces: a target may print a block's
  // statements without them, as Angular's methods do.
  place(owners.flatMap((owner) => splitAtBraces(owner, source)));
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
      owner.runs = literalRuns(span, owner.refs, source).map((piece) =>
        ownedRun(owner, piece, source),
      );
      owner.runs.forEach((run, index) => (run.index = index));
      owners.set(`${span.start}:${span.end}`, owner);
    }
    for (const item of Object.values(value)) visit(item);
  };
  visit(module);
  return [...owners.values()];
}

/**
 * A piece of text as a run of `owner`, with the references right beside it, if any. For a fallback
 * piece, cut at braces, that takes in a reference across what reads as the brace of a `${…}`. Any
 * other brace stays out, since a target may unwrap a block.
 */
function ownedRun(owner: Owner, piece: Piece, source: string, fallback = false): Run {
  const end = piece.start + piece.text.length;
  const beside = owner.refs.filter((ref) => ref.kind !== "Write" && ref.kind !== "Emit");
  const before = beside.find(({ span }) => {
    if (span.end > piece.start) return false;
    const gap = source.slice(span.end, piece.start).trim();
    return !gap || (fallback && gap === "}" && inSubstitution(source, span.start));
  });
  const after = beside.find(({ span: { start } }) => {
    if (start < end) return false;
    const gap = source.slice(end, start).trim();
    return !gap || (fallback && gap === "{" && piece.text.endsWith("$"));
  });
  return {
    ...piece,
    owner,
    index: 0,
    ...(before ? { before } : {}),
    ...(after ? { after } : {}),
  };
}

/** Whether the text before an offset opens a `${` that no `}` has closed: it reads text, not syntax. */
function inSubstitution(source: string, offset: number): boolean {
  const open = source.lastIndexOf("${", offset);
  return open >= 0 && !source.slice(open, offset).includes("}");
}

/**
 * Replaces each run of `owner` not found by its pieces between braces, and returns those. A short
 * piece or a lone word stays out, reference beside it or not: `.login`, `-$` or `groupTotal` could be
 * any line's, where `title: string` or a statement hardly could.
 */
function splitAtBraces(owner: Owner, source: string): Run[] {
  const pieces: Run[] = [];
  owner.runs = owner.runs.flatMap((run) => {
    if (run.at !== undefined) return [run];
    const own = piecesOf(run.text, run.start, BRACES)
      .filter(({ text }) => isDistinctive(text) && text.match(TOKENS)!.length > 1)
      .map((piece) => ownedRun(owner, piece, source, true));
    pieces.push(...own);
    return own;
  });
  owner.runs.forEach((run, index) => (run.index = index));
  return pieces;
}

/** The trimmed parts of a text between separators, each with a word, and where each starts. */
function piecesOf(text: string, start: number, separator: RegExp | string): Piece[] {
  const pieces: Piece[] = [];
  let at = start;
  for (const part of text.split(separator)) {
    const trimmed = part.trim();
    if (HAS_WORD.test(trimmed)) {
      pieces.push({ start: at + part.length - part.trimStart().length, text: trimmed });
    }
    at += part.length + 1;
  }
  return pieces;
}

/**
 * The text of a `Code` no reference covers, one piece per source line. A write's target and
 * operator, and an emit's call, go when a target replaces them whole; what they hold of the author's
 * text is a value's or an argument's, which stays literal.
 */
function literalRuns(span: Span, refs: readonly CodeReference[], source: string): Piece[] {
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
  const runs: Piece[] = [];
  const add = (start: number, end: number) => {
    runs.push(...piecesOf(source.slice(start, end), start, "\n"));
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
  { start, text, before, after }: Run,
  from: number,
  to: number,
  taken: Uint8Array,
  source: string,
): number {
  const gapBefore = before ? source.slice(before.span.end, start).trim() : "";
  const gapAfter = after ? source.slice(start + text.length, after.span.start).trim() : "";
  for (let at = output.indexOf(text, from); at >= 0; at = output.indexOf(text, at + 1)) {
    const end = at + text.length;
    if (end > to) return -1;
    if (
      !isTaken(taken, at, end) &&
      isWhole(output, at, end) &&
      (!before ||
        mentions(spellingBefore(output, at, gapBefore), before, source, gapBefore !== "")) &&
      (!after || mentions(spellingAfter(output, end, gapAfter), after, source, gapAfter !== ""))
    ) {
      return at;
    }
  }
  return -1;
}

function isDistinctive(text: string): boolean {
  return (text.match(WORD_CHARACTERS) ?? []).length >= DISTINCTIVE;
}

/** How many free places hold the text as whole tokens. */
function countFree(output: string, text: string, taken: Uint8Array): number {
  let count = 0;
  for (let at = output.indexOf(text); at >= 0; at = output.indexOf(text, at + 1)) {
    if (!isTaken(taken, at, at + text.length) && isWhole(output, at, at + text.length)) count++;
  }
  return count;
}

/** The spelling that ends at `end`, past whitespace and a brace the source holds there. */
function spellingBefore(output: string, end: number, gap: string): string {
  let last = end;
  while (last > 0 && isSpace(output.charCodeAt(last - 1))) last--;
  if (gap) {
    if (output[last - 1] !== gap) return "";
    last--;
    while (last > 0 && isSpace(output.charCodeAt(last - 1))) last--;
  }
  let first = last;
  while (first > 0 && SPELLING.test(output[first - 1]!)) first--;
  return output.slice(first, last);
}

/** The spelling that starts at `start`, past whitespace and a brace the source holds there. */
function spellingAfter(output: string, start: number, gap = ""): string {
  let first = start;
  while (first < output.length && isSpace(output.charCodeAt(first))) first++;
  if (gap) {
    if (output[first] !== gap) return "";
    first++;
    while (first < output.length && isSpace(output.charCodeAt(first))) first++;
  }
  let last = first;
  while (last < output.length && SPELLING.test(output[last]!)) last++;
  return output.slice(first, last);
}

/**
 * Whether a spelling names a reference. Targets keep the name in what they print (`props.label`,
 * `count()`, `this.count()`). One that doesn't leaves the reference and its neighbours unmapped.
 * Across a `${…}`'s brace it may name it in any case: a target's own name for a value there can
 * capitalise the source's, as React's `currentDoubled()` does for `doubled`.
 */
function mentions(spelling: string, ref: CodeReference, source: string, anyCase = false): boolean {
  const written =
    ref.kind === "Write"
      ? source.slice(ref.target.start, ref.target.end)
      : ref.kind === "Emit"
        ? (identifierAt(source, ref.span.start) ?? "")
        : source.slice(ref.span.start, ref.span.end);
  return (written.match(IDENTIFIERS) ?? []).some((name) =>
    anyCase ? spelling.toLowerCase().includes(name.toLowerCase()) : spelling.includes(name),
  );
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
 * The map of files joined into one module (the unplugin's script modules): `joined` maps the join
 * to the files, whose `sources` are their paths, and each file's own map goes on to its source. A
 * file with no map has nothing to go on to, so its text stays unmapped, and never points at a file
 * that exists only in the compile's output.
 */
export function composeJoinedMap(
  joined: Pick<SourceMapV3, "sources" | "names" | "mappings">,
  files: readonly OutputFile[],
): SourceMapV3 {
  const maps = new Map(files.map(({ path, map }) => [path, map]));
  const composed = remapping({ version: 3, ...joined }, (path, { depth }) =>
    // Deeper than the files, a source is what it is.
    depth === 1 ? (maps.get(path) ?? { version: 3, sources: [], names: [], mappings: "" }) : null,
  );
  return {
    version: 3,
    file: files.find(({ map }) => map)?.map?.file ?? "",
    sources: composed.sources as string[],
    sourcesContent: (composed.sourcesContent ?? []) as string[],
    names: composed.names,
    mappings: composed.mappings as string,
  };
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
