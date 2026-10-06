// `class={…}` (ADR-0038, design §1.5): lowered to parts every target writes its own way (Vue's
// and Svelte's class arrays and objects, Angular's `[class.x]`, React's inline `cx`). The
// rendered names are the union of the static names, the toggles whose condition holds and the
// names each dynamic part holds, in no particular order.

import type { Fix } from "@unframework/diagnostics";
import {
  createClassAttribute,
  createDynamicClass,
  createStaticClass,
  createToggleClass,
} from "@unframework/ir";
import type { ClassAttribute, ClassItem, Span } from "@unframework/ir";
import type { AST } from "@unframework/parser";

import { checkExpression, span } from "./expressions.ts";
import type { CheckedExpression } from "./expressions.ts";
import { isStaticString, reportCharacters, valueOf } from "./literals.ts";
import type { RenderContext } from "./render.ts";
import { describe, outside } from "./types/kinds.ts";

/** HTML's ASCII whitespace, which separates class names. */
const ASCII_WHITESPACE = /[\t\n\f\r ]+/;

/** A `class={…}` lowered: its parts, and whether they are all known at compile time. */
export interface LoweredClass {
  /** The attribute, when nothing in it was reported. */
  attribute: ClassAttribute | undefined;
  /** The static names, when every part is static: the attribute is then `class="…"`. */
  names: string[] | undefined;
  /** Whether anything in it was reported. */
  reported: boolean;
}

/** A part as it is collected, before the names are checked against each other. */
type Part =
  | { kind: "static"; names: string[]; at: Span }
  | { kind: "toggle"; names: string[]; condition: CheckedExpression; static: boolean; at: Span }
  | { kind: "dynamic"; value: CheckedExpression; at: Span };

/**
 * Lowers `class={value}`: string literals are static names, `cond && "a"` and object keys toggle
 * names, and any other string expression is a dynamic part. Arrays nest.
 */
export function lowerClass(value: AST.Expression, context: RenderContext): LoweredClass {
  const { reporter } = context;
  const mark = reporter.diagnostics.length;
  const parts: Part[] = [];
  collect(value, parts, context);
  // A name set twice by the static parts and toggles (UF3007).
  const seen = new Map<string, Span>();
  for (const part of parts) {
    if (part.kind === "dynamic") continue;
    for (const name of part.names) {
      const first = seen.get(name);
      if (first) {
        reporter.report(
          "UF3007",
          part.at,
          `The class \`${name}\` is listed twice in this \`class\`.`,
          {
            help: "List it once.",
            related: [{ span: first, message: "First listed here" }],
          },
        );
      } else {
        seen.set(name, part.at);
      }
    }
  }
  const reported = reporter.hasErrorsSince(mark);
  const allStatic = parts.every(
    (part) => part.kind === "static" || (part.kind === "toggle" && part.static),
  );
  const names = allStatic
    ? parts.flatMap((part) => (part.kind === "dynamic" ? [] : part.names))
    : undefined;
  if (reported || allStatic) return { attribute: undefined, names, reported };
  const items: ClassItem[] = parts.flatMap((part): ClassItem[] => {
    switch (part.kind) {
      case "static":
        return [createStaticClass(part.names.join(" "), part.at)];
      case "toggle":
        return part.names.map((name) =>
          createToggleClass(name, part.condition.expression, part.at),
        );
      default:
        return [createDynamicClass(part.value.expression, part.at)];
    }
  });
  return { attribute: createClassAttribute(items, span(value)), names: undefined, reported };
}

/** The names of a static string, split at ASCII whitespace, with other whitespace reported. */
function namesOf(node: AST.StringLiteral | AST.TemplateLiteral, context: RenderContext): string[] {
  const value = valueOf(node);
  reportCharacters(node, context.source, context.reporter);
  checkWhitespace(value, node, context);
  return value.split(ASCII_WHITESPACE).filter(Boolean);
}

/** Reports whitespace other than ASCII's in a class name, which Angular splits names at. */
function checkWhitespace(value: string, at: Span, context: RenderContext): void {
  const space = /[^\S\t\n\f\r ]/u.exec(value)?.[0];
  if (space === undefined) return;
  const code = `U+${space.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
  context.reporter.report(
    "UF3008",
    at,
    `A class name holds whitespace (${code}): Angular splits names there, and the other targets keep it in the name.`,
    { help: "Separate class names with spaces, and keep other whitespace out of them." },
  );
}

function collect(node: AST.Expression, parts: Part[], context: RenderContext): void {
  const { reporter } = context;
  if (isStaticString(node)) {
    const names = namesOf(node, context);
    if (names.length) parts.push({ kind: "static", names, at: span(node) });
    return;
  }
  if (isNothing(node)) return;
  switch (node.type) {
    case "ArrayExpression":
      for (const element of node.elements) {
        if (element === null) {
          reporter.unsupported(
            node,
            "Arrays with holes (`[a, , b]`) are not supported in a `class`: write the parts one after another.",
          );
        } else if (element.type === "SpreadElement") {
          reporter.report("UF3022", element, "A `class` array cannot spread another array.", {
            help: "Write its parts in the array itself.",
          });
        } else {
          collect(element, parts, context);
        }
      }
      return;
    case "ObjectExpression":
      collectObject(node, parts, context);
      return;
    case "LogicalExpression":
      if (node.operator === "&&") {
        collectToggle(node, parts, context);
        return;
      }
      break;
  }
  const value = checkExpression(node, context);
  checkDynamic(value, node, context);
  parts.push({ kind: "dynamic", value, at: span(node) });
}

/** `false`, `null` and `undefined` render no class, in an array as anywhere. */
function isNothing(node: AST.Expression): boolean {
  return (
    (node.type === "Literal" && (node.value === false || node.value === null)) ||
    (node.type === "Identifier" && node.name === "undefined")
  );
}

/** `cond && "a b"` toggles each name; `cond && expr` is written `cond ? expr : undefined`. */
function collectToggle(node: AST.LogicalExpression, parts: Part[], context: RenderContext): void {
  const { reporter, source } = context;
  const condition = checkExpression(node.left, context);
  if (isStaticString(node.right)) {
    const names = namesOf(node.right, context);
    if (names.length) {
      parts.push({ kind: "toggle", names, condition, static: false, at: span(node) });
    }
    return;
  }
  const value = checkExpression(node.right, context);
  const kinds = outside(value.kinds, ["string", "null", "undefined"]);
  const fixable = condition.clean && value.clean && !kinds.length;
  const left = source.slice(node.left.start, node.left.end);
  const right = source.slice(node.right.start, node.right.end);
  const fixes: Fix[] = fixable
    ? [
        {
          title: "Write it as a conditional",
          confidence: "safe",
          edits: [
            {
              span: { start: node.start, end: node.end },
              text: `${parenthesised(node.left, left)} ? ${parenthesised(node.right, right)} : undefined`,
            },
          ],
        },
      ]
    : [];
  parts.push({ kind: "dynamic", value, at: span(node) });
  reporter.report(
    "UF3018",
    node,
    "`cond && value` in a `class` renders `cond`'s own value when it is falsy, which the targets read differently in a class: a toggle's names are a string literal.",
    {
      help: kinds.length
        ? `Write \`cond && "name"\` for a name, or \`cond ? value : undefined\` for a string; the value can be ${describe(kinds)}, which a class cannot hold.`
        : "Write `cond ? value : undefined`.",
      fixes,
    },
  );
}

/** Wraps an operand's text in parentheses where a conditional's operand needs them. */
function parenthesised(node: AST.Expression, text: string): string {
  const bare =
    node.type === "Identifier" ||
    node.type === "Literal" ||
    node.type === "MemberExpression" ||
    node.type === "CallExpression" ||
    node.type === "TemplateLiteral" ||
    node.type === "ArrayExpression" ||
    node.type === "ObjectExpression" ||
    node.type === "UnaryExpression" ||
    node.type === "ChainExpression";
  return bare ? text : `(${text})`;
}

/** An object's keys are names, toggled by their values. */
function collectObject(node: AST.ObjectExpression, parts: Part[], context: RenderContext): void {
  const { reporter } = context;
  for (const property of node.properties) {
    if (
      property.type === "SpreadElement" ||
      property.computed ||
      property.method ||
      property.kind !== "init"
    ) {
      reporter.report(
        "UF3022",
        property.type === "SpreadElement" ? property : property.key,
        property.type === "SpreadElement"
          ? "A `class` object cannot spread another object: the targets toggle each name they can see."
          : property.computed
            ? "A `class` object's keys are class names: no computed keys."
            : "A `class` object's values are conditions: no methods, getters or setters.",
        { help: 'Write each class name as a key: `{ active: isActive, "is-busy": busy }`.' },
      );
      continue;
    }
    const { key } = property;
    const name =
      key.type === "Identifier"
        ? key.name
        : key.type === "Literal" && typeof key.value === "string"
          ? key.value
          : undefined;
    if (name === undefined) {
      reporter.report(
        "UF3022",
        key,
        "A `class` object's keys are class names: write them as names or strings.",
      );
      continue;
    }
    if (key.type === "Literal") checkWhitespace(name, key, context);
    const names = name.split(ASCII_WHITESPACE).filter(Boolean);
    if (!names.length) {
      reporter.report("UF3022", key, "A `class` object's key holds no class name.", {
        help: "Write a class name as the key.",
      });
      continue;
    }
    const value = property.value;
    if (value.type === "Literal" && value.value === false) continue;
    const condition = checkExpression(value, context);
    const always = value.type === "Literal" && value.value === true;
    parts.push({ kind: "toggle", names, condition, static: always, at: span(property) });
  }
}

/** A dynamic part's value must be a string, or nothing (UF3018, and arrays and objects M4). */
function checkDynamic(
  value: CheckedExpression,
  node: AST.Expression,
  context: RenderContext,
): void {
  const kinds = outside(value.kinds, ["string", "null", "undefined"]);
  if (!kinds.length) return;
  if (kinds.every((kind) => kind === "array" || kind === "object")) {
    context.reporter.unsupported(
      node,
      "A `class` part that holds an array or an object at run time is not supported yet: it lands in M4. Here it can be one.",
      {
        help: "Write the array or the object in the `class` itself, or join the names into a string.",
      },
    );
    return;
  }
  context.reporter.report(
    "UF3018",
    node,
    `A \`class\` part renders its string's names, and this one can be ${describe(kinds)}, which the targets render differently.`,
    {
      help: 'Write `cond && "name"` to toggle a name, or `String(value)` to render a number\'s digits.',
    },
  );
}
