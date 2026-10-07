// Functions the source writes (ADR-0045), printed from their parts: a hoisted handler (Angular's
// methods) needs the parameters, the body and the flags apart, and every other target prints
// them back as the author wrote them, with each reference respelled. The parts are copied as
// written (parameters, types, defaults); only the body's references are rewritten.
import type { FunctionCode, Handler, Parameter, UfComponent } from "@unframework/ir";

import { parseExpression } from "./parse.ts";
import { bindingOf, parenthesesNeeded, rewriteCode } from "./rewrite.ts";
import type { RewriteRules, RewriteSite } from "./rewrite.ts";

/** How {@link functionText} writes a function. */
export interface FunctionTextOptions {
  /**
   * `false` writes a `function` (a declaration when `name` is given), and an arrow otherwise:
   * by default, an arrow unless `name` is given.
   */
  arrow?: boolean;
  /** The name of a `function` declaration. */
  name?: string;
}

/**
 * A parameter as the source writes it, from its parts: `...rest: string[]`, `label?: string`,
 * `[unit]: string[] = ["x"]`. Its default is static, so it is copied as written.
 */
export function parameterText(parameter: Parameter): string {
  const binding = parameter.name ?? parameter.pattern?.code;
  if (binding === undefined) throw new Error("A parameter has neither a name nor a pattern.");
  return [
    parameter.rest ? "..." : "",
    binding,
    parameter.optional ? "?" : "",
    parameter.type ? `: ${parameter.type.code}` : "",
    parameter.default ? ` = ${parameter.default.code}` : "",
  ].join("");
}

/** A function's parameters as a list, without the parentheses: `event: MouseEvent, step = 1`. */
export function parametersText(fn: FunctionCode): string {
  return fn.parameters.map(parameterText).join(", ");
}

/**
 * A function as code, with its body's references spelled by `rules` for `site` (as written
 * without rules): an arrow, `async (event: KeyboardEvent): void => body`, or with `name` a
 * declaration, `async function save(…) {…}`, whose expression body becomes a `return`. An arrow's
 * expression body that is an object literal or a sequence is parenthesised.
 */
export function functionText(
  fn: FunctionCode,
  component: UfComponent,
  rules: RewriteRules | undefined,
  site: RewriteSite,
  options: FunctionTextOptions = {},
): string {
  return functionSource(fn, bodyCode(fn, component, rules, site), options);
}

/**
 * A function as code around a body already printed (`body` is its block, `{ … }`, or its
 * expression): see {@link functionText}.
 */
export function functionSource(
  fn: FunctionCode,
  body: string,
  options: FunctionTextOptions = {},
): string {
  const head = `${fn.async ? "async " : ""}`;
  const signature = `(${parametersText(fn)})${fn.returnType ? `: ${fn.returnType.code}` : ""}`;
  if (options.arrow ?? options.name === undefined) {
    return `${head}${signature} => ${fn.expression ? arrowBody(body) : body}`;
  }
  const name = options.name === undefined ? "" : ` ${options.name}`;
  const block = fn.expression ? `{\n  return ${body};\n}` : body;
  return `${head}function${name}${signature} ${block}`;
}

/**
 * A function's body as statements, for a body a target builds itself (a method, a hook's
 * callback): a block body's statements without its braces, or an expression body's `return
 * expression;`, or with `discard` (a handler's value, which every target drops) `expression;`.
 */
export function functionBodyText(
  fn: FunctionCode,
  component: UfComponent,
  rules: RewriteRules | undefined,
  site: RewriteSite,
  options: { discard?: boolean } = {},
): string {
  const body = bodyCode(fn, component, rules, site);
  if (fn.expression) {
    return options.discard ? `${expressionStatement(body)};` : `return ${body};`;
  }
  if (!body.startsWith("{") || !body.endsWith("}")) {
    throw new Error(`A function's block body is not a block: \`${body}\`.`);
  }
  return body.slice(1, -1).trim();
}

/**
 * A listener's handler as code for `site` (`client` by default): a named handler's function,
 * as the rules spell a reference to it at the handler's span, or an inline handler as an arrow
 * ({@link functionText}).
 */
export function handlerText(
  handler: Handler,
  component: UfComponent,
  rules: RewriteRules | undefined,
  site: RewriteSite = "client",
): string {
  switch (handler.kind) {
    case "Function": {
      const binding = bindingOf(component, handler.binding);
      if (!rules) return binding.name;
      const reference = { kind: "Binding" as const, binding: handler.binding, span: handler.span };
      return rules.binding(reference, binding, binding.name, site);
    }
    case "Inline":
      return functionText(handler.function, component, rules, site);
    default:
      return unreachable(handler);
  }
}

function bodyCode(
  fn: FunctionCode,
  component: UfComponent,
  rules: RewriteRules | undefined,
  site: RewriteSite,
): string {
  return rules ? rewriteCode(fn.body, component, rules, site) : fn.body.code;
}

/** An arrow's expression body: an object literal or a sequence in parentheses. */
function arrowBody(code: string): string {
  const expression = parseExpression(code);
  const unwrapped = !(code.startsWith("(") && expression.start > 0);
  return (unwrapped && code.startsWith("{")) || parenthesesNeeded(expression, code, "argument")
    ? `(${code})`
    : code;
}

/**
 * An expression as an expression statement: in parentheses where a statement would read it as
 * something else (`{`, `function`, `class`, `let [`).
 */
function expressionStatement(code: string): string {
  return /^(?:\{|function\b|class\b|async\s+function\b|let\s*\[)/.test(code) ? `(${code})` : code;
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
