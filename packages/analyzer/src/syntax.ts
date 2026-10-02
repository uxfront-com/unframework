import { applyEdits } from "@unframework/diagnostics";
import type { Fix, Span, TextEdit } from "@unframework/diagnostics";
import { parseModule } from "@unframework/parser";
import type { ParseError, ParsedModule } from "@unframework/parser";

/**
 * oxc's error for a `}` or `>` in JSX text, which advises `{'}'}` (an expression, which this
 * compiler cannot lower yet) or `&rbrace;` (which JSX does not decode, so every target would
 * render it as written). The tests pin the wording: if oxc changes it, they fail.
 */
const JSX_TEXT_TOKEN = /^Unexpected token\. Did you mean `\{'([>}])'\}` or `&(?:gt|rbrace);`\?$/;

/** The character reference every JSX implementation decodes, for each character. */
const REFERENCES: ReadonlyMap<string, string> = new Map([
  ["}", "&#x7D;"],
  [">", "&gt;"],
]);

/** A syntax error (UF1001) as the analyser reports it. */
export interface SyntaxReport {
  span: Span;
  message: string;
  help: string | undefined;
  fixes?: Fix[];
}

/**
 * The span, message, help and fixes of a syntax error (UF1001): the parser's own, except where
 * its advice would not compile, or would compile to other text.
 */
export function syntaxError(error: ParseError, parsed: ParsedModule): SyntaxReport {
  const token = textToken(error, parsed.source);
  if (token === undefined) return { span: error.span, message: error.message, help: error.help };
  const reference = REFERENCES.get(token)!;
  const why = `\`{'${token}'}\` is an expression, which is not supported yet${token === "}" ? ", and JSX does not decode `&rbrace;`" : ""}`;
  const edits = textRewrite(error, parsed);
  return {
    span: { start: error.span.start, end: error.span.start + 1 },
    message: `Unexpected token: JSX text cannot hold a raw \`${token}\`.`,
    // An element left open makes text of the code after it, whose `}` the parser reports.
    help: edits
      ? `Write \`${reference}\` for the character: ${why}.`
      : `If the \`${token}\` is text, write \`${reference}\`: ${why}. If it is code, close the element before it.`,
    ...(edits
      ? {
          fixes: [
            {
              title:
                edits.length === 1
                  ? `Write \`${reference}\``
                  : "Write each raw `}` and `>` in the JSX text as a character reference",
              confidence: "likely" as const,
              edits,
            },
          ],
        }
      : {}),
  };
}

/**
 * The `}` or `>` of the parser's error for a raw one in JSX text, at `at` in the source, or
 * `undefined`.
 */
function textToken(error: ParseError, source: string, at = error.span.start): string | undefined {
  const token = JSX_TEXT_TOKEN.exec(error.message)?.[1];
  return token !== undefined && source[at] === token ? token : undefined;
}

/**
 * The edits that write each `}` and `>` as a reference, from the error's to the end of its JSX
 * text, and on through each text the parser then reports the same error in (it stops at the
 * first), when the source then parses with exactly the parser's other errors; `undefined`
 * otherwise. The re-parse is what tells text from the code after an element left open: there
 * the rewrite only moves the error, so it is not offered. Only the parse is checked: a syntax
 * error stops the analysis, so what the analysis reports after the rewrite was there before.
 */
function textRewrite(error: ParseError, parsed: ParsedModule): TextEdit[] | undefined {
  const { file, source } = parsed;
  const expected = parsed.errors.filter((other) => other !== error).map((other) => key(other));
  const edits: TextEdit[] = [];
  let from = error.span.start;
  for (;;) {
    let end = from;
    for (; end < source.length && source[end] !== "<" && source[end] !== "{"; end++) {
      const text = REFERENCES.get(source[end]!);
      if (text) edits.push({ span: { start: end, end: end + 1 }, text });
    }
    const errors = parseModule(file, applyEdits(source, edits)).errors;
    const unexpected = [...errors];
    for (const other of expected) {
      const index = unexpected.findIndex((candidate) => key(candidate, edits) === other);
      if (index !== -1) unexpected.splice(index, 1);
    }
    if (errors.length - unexpected.length !== expected.length) return undefined;
    if (!unexpected.length) return edits;
    // Only the same error, in a text after this one, is the parser meeting the next raw one.
    if (unexpected.length > 1) return undefined;
    const next = unexpected[0]!;
    const at = original(next.span.start, edits);
    if (at <= end || textToken(next, source, at) === undefined) return undefined;
    from = at;
  }
}

/** An error as compared before and after the rewrite: its message and its spans in the source. */
function key(error: ParseError, edits: readonly TextEdit[] = []): string {
  const spans = error.labels.map(
    ({ span }) => `${original(span.start, edits)}-${original(span.end, edits)}`,
  );
  return `${error.message} ${spans.join(" ")}`;
}

/** The offset in the source of an offset in it after `edits` (in source order) are applied. */
function original(offset: number, edits: readonly TextEdit[]): number {
  let shift = 0;
  for (const edit of edits) {
    const start = edit.span.start + shift;
    if (offset < start) break;
    if (offset < start + edit.text.length) return edit.span.start;
    shift += edit.text.length - (edit.span.end - edit.span.start);
  }
  return offset - shift;
}
