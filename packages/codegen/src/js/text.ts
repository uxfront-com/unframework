// Rendered values as one JavaScript string, for a target whose framework takes one string where
// the source has several parts (an SVG `<title>`'s children in React and Qwik, ADR-0040): a
// template literal of the parts, each value written into it as an interpolation renders it.
// `null` and `undefined` render nothing on every target (ADR-0037), where a template literal
// writes them, so a part that may be nullish is guarded with `?? ""`. The guard goes only where
// TypeScript reads the value's syntax as sometimes nullish: `??` after a value it reads as never
// or always nullish fails L4 (TS2869, TS2871). Which parts a target joins, and which values it
// knows to be text, are the target's to decide.
import type * as AST from "@oxc-project/types";

import { parseExpression } from "../rewrite.ts";
import { conditionalExpression, logicalExpression, stringLiteral } from "./builders.ts";
import type { Placeholders } from "./placeholders.ts";

/** How TypeScript reads a value's nullishness from its syntax. */
export type Nullishness = "never" | "sometimes" | "always";

/** A part of a text: literal text, or an expression whose value is written into it. */
export type TextPart = string | AST.Expression;

/**
 * Parts as one template literal, adjacent texts joined; or their text when no part is an
 * expression. Texts are escaped for a template literal's raw text: backslashes, backticks and
 * `${`, and control characters (a line feed, a tab) as the escapes a string literal writes.
 */
export function textTemplate(parts: readonly TextPart[]): AST.TemplateLiteral | string {
  const texts = [""];
  const expressions: AST.Expression[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      texts[texts.length - 1] += part;
    } else {
      expressions.push(part);
      texts.push("");
    }
  }
  if (!expressions.length) return texts[0]!;
  const quasis = texts.map((cooked, index): AST.TemplateElement => ({
    type: "TemplateElement",
    value: { raw: templateRaw(cooked), cooked },
    tail: index === texts.length - 1,
    start: 0,
    end: 0,
  }));
  return { type: "TemplateLiteral", quasis, expressions, start: 0, end: 0 };
}

function templateRaw(cooked: string): string {
  return cooked.replace(/[\\`]|\$\{|\p{Cc}/gu, (match) =>
    match.length > 1 || match === "\\" || match === "`"
      ? `\\${match}`
      : JSON.stringify(match).slice(1, -1),
  );
}

/**
 * Code (one expression, as the target spells it) as a part of a text: as it is where it is never
 * nullish, `code ?? ""` where it may be, and `undefined` where it always is, since it then
 * renders nothing (`c ? null : undefined`, `void x`). TypeScript reads `a ?? null`, and a
 * conditional of such values, as always nullish, though `a` renders: their nullish fallbacks
 * become `""` (`a ?? ""`) instead of taking a guard. The expression holds placeholders of
 * `placeholders`.
 */
export function nullishText(code: string, placeholders: Placeholders): AST.Expression | undefined {
  const root = parseExpression(code);
  // The root keeps the author's parentheses and comments around it; a part is its own code.
  const source = (node: AST.Expression) =>
    node === root ? code : code.slice(node.start, node.end);
  const guarded = (node: AST.Expression): AST.Expression | undefined => {
    if (isAlwaysNullish(node)) return undefined;
    const reading = syntacticNullishness(node);
    if (reading === "never") return placeholders.expression(source(node));
    if (reading === "sometimes") {
      return logicalExpression(
        "??",
        placeholders.expression(source(node), "operand"),
        stringLiteral(""),
      );
    }
    const inner = unwrapped(node);
    if (inner.type === "LogicalExpression" && inner.operator === "??") {
      if (isAlwaysNullish(inner.right)) return guarded(inner.left);
      const left = placeholders.expression(source(inner.left), "operand");
      return logicalExpression("??", left, guarded(inner.right)!);
    }
    if (inner.type === "ConditionalExpression") {
      return conditionalExpression(
        placeholders.expression(source(inner.test), "test"),
        guarded(inner.consequent) ?? stringLiteral(""),
        guarded(inner.alternate) ?? stringLiteral(""),
      );
    }
    // A comma or an assignment, which the analyser rejects as impure.
    throw new Error(`TypeScript reads \`${source(node)}\` as always nullish, though it renders.`);
  };
  return guarded(root);
}

/**
 * Whether a value may be `null` or `undefined`, read from its syntax exactly as TypeScript reads
 * it (`getSyntacticNullishnessSemantics`, which decides TS2869 and TS2871): `??`, `=`, `??=` and
 * the comma by their right operand, a conditional by both branches, `||` and `&&` as sometimes,
 * a read or a call as sometimes, and anything else (literals, operators, `void x`) as never.
 */
export function syntacticNullishness(node: AST.Expression): Nullishness {
  const inner = unwrapped(node);
  switch (inner.type) {
    case "Literal":
      return inner.raw === "null" ? "always" : "never";
    case "Identifier":
      return inner.name === "undefined" ? "always" : "sometimes";
    case "ConditionalExpression": {
      const consequent = syntacticNullishness(inner.consequent);
      return consequent === syntacticNullishness(inner.alternate) ? consequent : "sometimes";
    }
    case "LogicalExpression":
      return inner.operator === "??" ? syntacticNullishness(inner.right) : "sometimes";
    case "AssignmentExpression":
      if (inner.operator === "=" || inner.operator === "??=") {
        return syntacticNullishness(inner.right);
      }
      return inner.operator === "||=" || inner.operator === "&&=" ? "sometimes" : "never";
    case "SequenceExpression":
      return syntacticNullishness(inner.expressions.at(-1)!);
    case "MemberExpression":
    case "ChainExpression":
    case "CallExpression":
    case "ImportExpression":
    case "NewExpression":
    case "TaggedTemplateExpression":
    case "AwaitExpression":
    case "YieldExpression":
    case "ThisExpression":
    case "MetaProperty":
      return "sometimes";
    default:
      return "never";
  }
}

/**
 * Whether a value is `null` or `undefined` whenever it runs, and so renders nothing: where
 * TypeScript's reading differs, it calls `void x` never nullish, and `a ?? null` always.
 */
export function isAlwaysNullish(node: AST.Expression): boolean {
  const inner = unwrapped(node);
  switch (inner.type) {
    case "Literal":
      return inner.raw === "null";
    case "Identifier":
      return inner.name === "undefined";
    case "UnaryExpression":
      return inner.operator === "void";
    case "ConditionalExpression":
      return isAlwaysNullish(inner.consequent) && isAlwaysNullish(inner.alternate);
    case "LogicalExpression":
      // `a && b` is `a` whenever `a` is nullish; `||` and `??` are nullish when both sides are.
      return (
        isAlwaysNullish(inner.left) && (inner.operator === "&&" || isAlwaysNullish(inner.right))
      );
    default:
      return false;
  }
}

/** A value without the parentheses and type syntax around it, which TypeScript sees through. */
function unwrapped(node: AST.Expression): AST.Expression {
  switch (node.type) {
    case "ParenthesizedExpression":
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSNonNullExpression":
    case "TSTypeAssertion":
    case "TSInstantiationExpression":
      return unwrapped(node.expression);
    default:
      return node;
  }
}
