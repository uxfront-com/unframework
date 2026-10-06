// Hand-built IR expressions for the printer tests: the analyser lowers real sources, but the
// printers must also be pinned on shapes it is still learning to produce.
import {
  createBindingReference,
  createExpression,
  createGlobalReference,
  span,
} from "@unframework/ir";
import type { Binding, Expression, Reference } from "@unframework/ir";

/** A reference to find in an expression's code: a binding's, or the global of that name. */
export type ReferenceTarget = [text: string, target: Binding | "Global"];

/**
 * An expression at `offset` whose references are found in its code: each `[text, target]`
 * takes the next occurrence of `text` that is a variable (not a member `.text` or a key
 * `text:`), as a binding reference (a shorthand one between `{`/`,` and `,`/`}`) or a
 * reference to the global `text`.
 */
export function expressionAt(offset: number, code: string, ...refs: ReferenceTarget[]): Expression {
  let from = 0;
  const references = refs.map(([text, target]): Reference => {
    const variable = new RegExp(`(?<![.\\w$])${text.replace(".", "\\.")}(?![\\w$]|\\s*:)`, "g");
    variable.lastIndex = from;
    const start = variable.exec(code)?.index;
    if (start === undefined) throw new Error(`No ${text} in ${code} after ${from}`);
    from = start + text.length;
    const at = span(offset + start, offset + start + text.length);
    if (target === "Global") return createGlobalReference(text, at);
    const shorthand =
      /(?:[^$]\{|,)\s*$/.test(code.slice(0, start)) && /^\s*[,}]/.test(code.slice(from));
    return createBindingReference(target.id, at, shorthand);
  });
  return createExpression(code, span(offset, offset + code.length), references);
}
