// `class` from parts (ADR-0038). Qwik's `class` takes Vue's forms natively
// (`ClassList`: strings, arrays and objects of conditions, nested), so the parts are written
// as the source wrote them, with no helper: a lone dynamic part as itself (`class={tone}`),
// toggles alone as one object (`class={{ active, muted }}`), and anything else as an array.
import { expressionCode, js, jsxExpression, spreadClassReads } from "@unframework/codegen";
import type { JsxContext } from "@unframework/codegen";
import type { ClassAttribute, ElementNode, Expression, ToggleClass } from "@unframework/ir";

type JsxAttribute = ReturnType<typeof js.jsxAttribute>;
// The ESTree node types, named through codegen's builders: a target imports only ir and codegen.
type AstExpression = Parameters<typeof js.conditionalExpression>[0];

/**
 * The `class` attribute of an element from its parts, merging the `class` of a spread on it
 * (ADR-0039). `isPrimitive` tells whether a toggle's condition is certainly a boolean, number,
 * string or nullish value, which Qwik's object form takes as it is; any other condition (an
 * array, an object, or a value whose type the target cannot see) is written `Boolean(…)`, or
 * it fails Qwik's types (L4).
 */
export function qwikClassAttribute(
  attribute: ClassAttribute,
  element: ElementNode,
  context: JsxContext,
  isPrimitive: (condition: Expression) => boolean,
): JsxAttribute[] {
  const items = classItems(attribute, context, isPrimitive);
  const reads = spreadClassReads(element, context);
  const [only] = items;
  const value =
    items.length === 1 && reads.length === 0 && only!.type !== "Literal"
      ? only!
      : js.arrayExpression([...items, ...reads]);
  return [js.jsxAttribute("class", js.jsxExpressionContainer(value))];
}

/**
 * The parts as Qwik's `ClassList` items, in order: static names as strings, a dynamic part as
 * written, and each run of toggles as one object. Toggles from one source entry (`{ "a b": on
 * }` or `on && "a b"`, one toggle per name in the IR) share one condition and are joined back
 * into one key, which Qwik splits as the source did.
 */
function classItems(
  attribute: ClassAttribute,
  context: JsxContext,
  isPrimitive: (condition: Expression) => boolean,
): AstExpression[] {
  const items: AstExpression[] = [];
  let toggles: ToggleClass[] = [];
  const flush = () => {
    if (toggles.length) items.push(toggleObject(toggles, context, isPrimitive));
    toggles = [];
  };
  for (const item of attribute.items) {
    if (item.kind === "Toggle") {
      toggles.push(item);
      continue;
    }
    flush();
    items.push(
      item.kind === "Static" ? js.stringLiteral(item.value) : jsxExpression(item.value, context),
    );
  }
  flush();
  return items;
}

/**
 * A run of toggles as one object, `{ active, "is-busy is-waiting": busy }`: adjacent toggles
 * with the same condition (the same source span) share a key, and a key that is its own
 * condition is written shorthand.
 */
function toggleObject(
  toggles: readonly ToggleClass[],
  context: JsxContext,
  isPrimitive: (condition: Expression) => boolean,
): AstExpression {
  const groups: { names: string[]; condition: Expression }[] = [];
  for (const toggle of toggles) {
    const last = groups.at(-1);
    if (last && sameSpan(last.condition, toggle.condition)) last.names.push(toggle.name);
    else groups.push({ names: [toggle.name], condition: toggle.condition });
  }
  return js.objectExpression(
    groups.map(({ names, condition }) => {
      const key = names.join(" ");
      if (!isPrimitive(condition)) {
        const wrapped = js.callExpression(js.identifier("Boolean"), [
          jsxExpression(condition, context),
        ]);
        return js.property(key, wrapped);
      }
      if (expressionCode(condition, context) === key) {
        return js.property(key, js.identifier(key), { shorthand: true });
      }
      return js.property(key, jsxExpression(condition, context));
    }),
  );
}

function sameSpan(a: Expression, b: Expression): boolean {
  return a.span.start === b.span.start && a.span.end === b.span.end;
}
