// Hand-built IR expressions for the printer tests: the analyser lowers real sources, but the
// printers must also be pinned on shapes it is still learning to produce.
import {
  createApiReference,
  createBindingReference,
  createCode,
  createEmitReference,
  createEventReference,
  createExpression,
  createGlobalReference,
  createWriteReference,
  span,
} from "@unframework/ir";
import type { Binding, Code, CodeReference, Expression, Reference } from "@unframework/ir";

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

/**
 * A reference to find in setup code: a binding's or a global's (as {@link ReferenceTarget}), a
 * local function's call, an event parameter's member, `nextTick`, or a write or an emit with the
 * parts to find in its text.
 */
export type CodeTarget =
  | ReferenceTarget
  | { call: string; binding: Binding }
  | { member: string; text: string; call?: boolean }
  | { api: string }
  | {
      write: string;
      binding: Binding;
      operator: string;
      target: string;
      value?: string;
      arrowBody?: boolean;
    }
  | { emit: string; binding: Binding; event: string; arguments?: string[] };

/**
 * Setup code at `offset` whose references are found in its code, in order: each target takes the
 * next occurrence of its text, after the previous reference, or inside the previous write's value
 * or emit's arguments, where the references that follow a write or an emit start (ADR-0045).
 */
export function codeAt(offset: number, code: string, ...targets: CodeTarget[]): Code {
  let from = 0;
  const at = (start: number, text: string) => span(offset + start, offset + start + text.length);
  const variable = (text: string): number => {
    const pattern = new RegExp(`(?<![.\\w$])${text.replace(/\./g, "\\.")}(?![\\w$]|\\s*:)`, "g");
    pattern.lastIndex = from;
    const start = pattern.exec(code)?.index;
    if (start === undefined) throw new Error(`No ${text} in ${code} after ${from}`);
    return start;
  };
  const text = (written: string): number => {
    const start = code.indexOf(written, from);
    if (start === -1) throw new Error(`No ${written} in ${code} after ${from}`);
    return start;
  };
  const refs = targets.map((target): CodeReference => {
    if (Array.isArray(target)) {
      const [name, binding] = target;
      const start = variable(name);
      from = start + name.length;
      if (binding === "Global") return createGlobalReference(name, at(start, name));
      const shorthand =
        innermostBracket(code.slice(0, start)) === "{" &&
        /(?:\{|,)\s*$/.test(code.slice(0, start)) &&
        /^\s*[,}]/.test(code.slice(from));
      return createBindingReference(binding.id, at(start, name), shorthand);
    }
    if ("call" in target && "binding" in target) {
      const start = variable(target.call);
      from = start + target.call.length;
      return createBindingReference(target.binding.id, at(start, target.call), false, true);
    }
    if ("member" in target) {
      const start = variable(target.text);
      from = start + target.text.length;
      return createEventReference(target.member, at(start, target.text), target.call);
    }
    if ("api" in target) {
      const start = variable(target.api);
      from = start + target.api.length;
      return createApiReference("nextTick", at(start, target.api));
    }
    if ("write" in target) {
      const start = text(target.write);
      const targetStart = target.write.indexOf(target.target);
      const valueStart =
        target.value === undefined
          ? -1
          : target.write.indexOf(target.value, targetStart + target.target.length);
      from = valueStart === -1 ? start + target.write.length : start + valueStart;
      return createWriteReference(
        target.binding.id,
        target.operator,
        at(start, target.write),
        at(start + targetStart, target.target),
        target.value === undefined ? undefined : at(start + valueStart, target.value),
        target.arrowBody,
      );
    }
    const start = text(target.emit);
    let cursor = target.emit.indexOf("(");
    const args = (target.arguments ?? []).map((argument) => {
      const position = target.emit.indexOf(argument, cursor + 1);
      cursor = position + argument.length - 1;
      return at(start + position, argument);
    });
    from = args.length ? args[0]!.start - offset : start + target.emit.length;
    return createEmitReference(target.binding.id, target.event, at(start, target.emit), args);
  });
  return createCode(code, span(offset, offset + code.length), refs);
}

/** The innermost bracket left open in code (strings aside, which the tests' code avoids). */
function innermostBracket(code: string): string | undefined {
  const open: string[] = [];
  for (const character of code) {
    if ("{[(".includes(character)) open.push(character);
    else if ("}])".includes(character)) open.pop();
  }
  return open.at(-1);
}
