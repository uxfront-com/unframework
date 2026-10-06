// An element's attributes (design §1.5): each attribute is read on its own first (its name, then
// its value: a string, a literal in braces, a binding, a class, a style or a spread), then checked
// against its element and the others. An attribute with a problem is reported and left out.

import type { Fix } from "@unframework/diagnostics";
import {
  BINDABLE_BOOLEAN_ATTRIBUTES,
  canonicalNumber,
  CHILDLESS_ATTRIBUTES,
  createBoundAttribute,
  createSpreadAttribute,
  createSpreadKey,
  createStaticAttribute,
  GENERATED_ID_PREFIX,
  idReferencesIn,
  isBooleanAttribute,
  isDataAttribute,
  isDroppedEmptyUrl,
  isNumberTypedAttribute,
  isStateAttribute,
  NULLISH_VALUE_ELEMENTS,
  NUMERIC_ATTRIBUTES,
  TRUE_VALUED_ATTRIBUTES,
  unanalysableUrl,
  unbindableAttribute,
} from "@unframework/ir";
import type { Attribute, Namespace, NumberKind, Span, SpreadKey } from "@unframework/ir";
import type { AST } from "@unframework/parser";

import { ARIA_TYPES, ariaValueProblem, roleProblem } from "./aria.ts";
import {
  canonicalName,
  formState,
  isAttributeOf,
  isStringOnlyAttribute,
  isTargetStringAttribute,
  MUTED_REASON,
  nameProblem,
  unsupported,
} from "./attribute-names.ts";
import type { Problem } from "./attribute-names.ts";
import { unportableCharacters } from "./characters.ts";
import { lowerClass } from "./class.ts";
import type { LoweredClass } from "./class.ts";
import { reportCharacter, reportDivergence, reportHtmlOnlyReference } from "./context.ts";
import type { RawSpan, Reporter } from "./context.ts";
import { emptyValue, enumeratedProblem, enumeratedStaticProblem } from "./enumerated.ts";
import { checkExpression, span } from "./expressions.ts";
import type { CheckedExpression } from "./expressions.ts";
import { htmlOnlyReferences, readJsxAttribute } from "./jsx/text.ts";
import type { HtmlOnlyReference, Piece } from "./jsx/text.ts";
import { isStaticString, piecesOf, reportCharacters, valueOf } from "./literals.ts";
import type { StaticString } from "./literals.ts";
import type { RenderContext } from "./render.ts";
import { spreadSource } from "./spread-source.ts";
import { lowerStaticStyle, lowerStyleObject } from "./style.ts";
import type { LoweredStyle } from "./style.ts";
import { declaredShapeOf, describe, has, outside, union, UNDEFINED } from "./types/kinds.ts";
import type { Kinds, Primitive } from "./types/kinds.ts";

export { list } from "./attribute-names.ts";

/** What the attributes' checks need to know about their element. */
export interface ElementContext {
  /** The element's tag, as the checks read it. */
  tag: string;
  /** The element's own namespace. */
  namespace: Namespace;
  /** Whether the element has content: an element, an expression, or text some JSX reads. */
  hasChildren: boolean;
  /** Whether the element is the one a list's `.map` renders: its `key` is the list's. */
  listBody: boolean;
  render: RenderContext;
}

/** An element's attributes, lowered. */
export interface LoweredAttributes {
  attributes: Attribute[];
  /** A list body's `key`, which its list lifts off the element. */
  key: AST.JSXAttribute | undefined;
  /** Whether an attribute binds anything: a binding, a spread, a dynamic class or style. */
  binds: boolean;
  /** The first static attribute whose value holds `{{`, which Angular cannot write statically. */
  braces: AST.JSXAttribute | undefined;
}

/**
 * A literal written in braces (`title={"x"}`, `disabled={true}`, `tabindex={0}`, `title={null}`),
 * which is a static attribute, or none: its canonical spelling (P3) is the static one.
 */
interface Literal {
  /** The canonical attribute, from its name on: `disabled`, `title="x"`, or none (removed). */
  text: string | undefined;
  /** Whether the canonical spelling reads as this value: no `&`, `"`, `\` or line break. */
  rewritable: boolean;
}

/** How an attribute's value is written. */
type Form =
  | {
      kind: "static";
      /** The decoded value, or `null` without one. */
      value: string | null;
      /** Whether its value has a problem already reported (UF3009, UF3010). */
      reported: boolean;
      /** The references in it that only HTML decodes, to report once its checks are known. */
      references: HtmlOnlyReference[];
      literal?: Literal;
    }
  /** A literal that renders no attribute: `{null}`, `{undefined}`, a boolean's `{false}`. */
  | { kind: "absent"; literal: Literal }
  | { kind: "bound"; value: CheckedExpression }
  | { kind: "class"; lowered: LoweredClass; container: AST.JSXExpressionContainer }
  | { kind: "style"; lowered: LoweredStyle; literal?: Literal };

/** An attribute that passed the name checks, before the checks that need its element. */
interface Read {
  /** The HTML or SVG name: `className` reads as `class`. */
  name: string;
  /** The name as written. */
  authored: string;
  node: AST.JSXAttribute;
  /** The attribute's name, where its diagnostics point. */
  nameNode: AST.JSXIdentifier | AST.JSXNamespacedName;
  /** Where the source before it ends: removing it removes from there. */
  after: number;
  form: Form;
}

/** A spread, read on its own. */
interface SpreadRead {
  node: AST.JSXSpreadAttribute;
  /** Whether it binds anything once fixed: a spread of a literal object of strings does not. */
  binds: boolean;
  /** The spread, when its keys are known and fit the element. */
  attribute: Attribute | undefined;
  /** The keys it sets, with where its type declares each. */
  keys: { name: string; key: Span }[];
}

/**
 * Reads, validates and lowers an element's attributes. Every attribute is checked on its own
 * first (name, reserved syntax, how its value is written and what kind it is), then against
 * the element (form state, submit-only attributes) and the others (duplicates).
 */
export function lowerAttributes(
  opening: AST.JSXOpeningElement,
  element: ElementContext,
): LoweredAttributes {
  const { reporter } = element.render;
  const entries: (Read | SpreadRead)[] = [];
  let key: AST.JSXAttribute | undefined;
  let after = opening.name.end;
  for (const item of opening.attributes) {
    const previous = after;
    after = item.end;
    if (item.type === "JSXSpreadAttribute") {
      entries.push(readSpread(item, previous, opening, element));
      continue;
    }
    const nameNode = item.name;
    const authored =
      nameNode.type === "JSXNamespacedName"
        ? `${nameNode.namespace.name}:${nameNode.name.name}`
        : nameNode.name;
    if (nameNode.type === "JSXNamespacedName" && !/^(xlink|xml|xmlns):/.test(authored)) {
      reporter.unsupported(nameNode, "Namespaced attributes are not supported yet.");
      continue;
    }
    const name = canonicalName(element.tag, element.namespace, authored);
    if (name === "key") {
      if (!element.listBody) misplacedKey(item, previous, reporter);
      else if (key) {
        reporter.report("UF3007", nameNode, `\`key\` is set twice on this <${element.tag}>.`, {
          help: "Keep one: the targets disagree about which value wins.",
          related: [{ span: span(key.name), message: "First set here" }],
        });
      } else {
        // Only JSX's own `key` keys an element, and any other case of it is an ordinary
        // attribute in JSX: it is reported, and lifted all the same, so its fix reveals nothing.
        if (authored !== "key") keyCase(item, nameNode, reporter);
        key = item;
      }
      continue;
    }
    const problem = nameProblem(
      element.tag,
      element.namespace,
      authored,
      name,
      item.value?.type === "JSXExpressionContainer",
    );
    if (problem) {
      report(reporter, nameNode, problem);
      continue;
    }
    const form = readForm(item, name, element);
    if (form) entries.push({ name, authored, node: item, nameNode, after: previous, form });
  }
  const binds = entries.some(
    (entry) =>
      (!("form" in entry) && entry.binds) ||
      ("form" in entry && entry.form.kind === "bound") ||
      ("form" in entry && entry.form.kind === "class" && !entry.form.lowered.names) ||
      ("form" in entry && entry.form.kind === "style" && entry.form.lowered.binds),
  );
  const braces = entries.find(
    (entry): entry is Read =>
      "form" in entry &&
      entry.form.kind === "static" &&
      (entry.form.value?.includes("{{") ?? false),
  )?.node;
  return { attributes: checkAgainstElement(entries, element), key, binds, braces };
}

/** `key` outside a list's element (UF3014): it does nothing there, and the fix removes it. */
function misplacedKey(item: AST.JSXAttribute, after: number, reporter: Reporter): void {
  reporter.report(
    "UF3014",
    item.name,
    "`key` belongs on the element a list's `.map` renders: elsewhere React and Vue remount the element when it changes, and the others ignore it.",
    {
      help: "Remove it.",
      fixes: [
        {
          title: "Remove `key`",
          confidence: "safe",
          edits: [{ span: { start: after, end: item.end }, text: "" }],
        },
      ],
    },
  );
}

/**
 * A list's key written in another case (`KEY={item.id}`, UF3004). A key in braces gets the
 * rename; any other is a constant key, whose fix (UF3014) writes the whole attribute.
 */
function keyCase(
  item: AST.JSXAttribute,
  nameNode: AST.JSXIdentifier | AST.JSXNamespacedName,
  reporter: Reporter,
): void {
  const authored = nameNode.type === "JSXIdentifier" ? nameNode.name : "";
  if (item.value?.type !== "JSXExpressionContainer") return;
  reporter.report(
    "UF3004",
    nameNode,
    `\`${authored}\` is written \`key\`: only JSX's \`key\`, in lower case, keys a list's element, and any other case is an attribute.`,
    {
      fixes: [
        {
          title: `Rename \`${authored}\` to \`key\``,
          confidence: "safe",
          edits: [{ span: span(nameNode), text: "key" }],
        },
      ],
    },
  );
}

/** Reads how an attribute's value is written, and checks the value on its own. */
function readForm(item: AST.JSXAttribute, name: string, element: ElementContext): Form | undefined {
  const { render } = element;
  const { reporter, source } = render;
  const value = item.value;
  if (value === null) return { kind: "static", value: null, reported: false, references: [] };
  if (value.type === "Literal") {
    const read = readValue(name, value, reporter);
    if (name === "style") {
      return {
        kind: "style",
        lowered: read.reported
          ? { attribute: undefined, empty: false, binds: false }
          : lowerStaticStyle(read.value, read.pieces, span(value), reporter),
      };
    }
    return {
      kind: "static",
      value: read.value,
      reported: read.reported,
      references: htmlOnlyReferences(value.value),
    };
  }
  if (value.type !== "JSXExpressionContainer") {
    reporter.report(
      "UF3012",
      value,
      "JSX cannot be an attribute's value: only a child, a branch of a conditional child or the element a list's `.map` renders.",
      { help: "Write the JSX as a child, or extract a component (composition lands in M3)." },
    );
    return undefined;
  }
  const expression = value.expression;
  if (expression.type === "JSXEmptyExpression") {
    reporter.unsupported(value, "An attribute's value cannot be empty.", {
      help: "Write a value, or no attribute.",
    });
    return undefined;
  }
  if (isStaticString(expression)) {
    const cooked = valueOf(expression);
    const literal: Literal = {
      text: `${name}="${cooked}"`,
      rewritable: rewritable(expression, source),
    };
    const reported = reportCharacters(expression, source, reporter);
    if (name === "style") {
      return {
        kind: "style",
        lowered: reported
          ? { attribute: undefined, empty: false, binds: false }
          : lowerStaticStyle(cooked, piecesOf(expression, source), span(expression), reporter),
        literal,
      };
    }
    return { kind: "static", value: cooked, reported, references: [], literal };
  }
  if (name === "class") {
    return { kind: "class", lowered: lowerClass(expression, render), container: value };
  }
  if (name === "style") {
    if (expression.type === "ObjectExpression") {
      return { kind: "style", lowered: lowerStyleObject(expression, render) };
    }
    reporter.unsupported(
      expression,
      "A `style` bound to anything but an object literal is not supported yet: it lands in M4.",
      { help: 'Write the declarations in an object: `style={{ color: tone, "--gap": gap }}`.' },
    );
    return undefined;
  }
  const literal = literalForm(expression, name, element);
  if (literal) return literal;
  return { kind: "bound", value: checkExpression(expression, render) };
}

/**
 * A literal in braces that is a static attribute, or none (P3): `{true}` and `{false}` where a
 * boolean renders as presence or as `"true"` and `"false"`, `{null}` and `{undefined}`
 * anywhere, and a number where a number renders as its digits. Others are bindings, whose kinds
 * the checks reject where they do not fit.
 */
function literalForm(
  expression: AST.Expression,
  name: string,
  element: ElementContext,
): Form | undefined {
  const { tag, namespace } = element;
  const boolean = namespace === "html" && isBooleanAttribute(name);
  const enumerated = trueFalseAttribute(name);
  if (
    (expression.type === "Literal" && expression.value === null) ||
    (expression.type === "Identifier" && expression.name === "undefined")
  ) {
    return { kind: "absent", literal: { text: undefined, rewritable: true } };
  }
  if (expression.type === "Literal" && typeof expression.value === "boolean") {
    if (boolean) {
      return expression.value
        ? {
            kind: "static",
            value: null,
            reported: false,
            references: [],
            literal: { text: name, rewritable: true },
          }
        : { kind: "absent", literal: { text: undefined, rewritable: true } };
    }
    if (enumerated) {
      return {
        kind: "static",
        value: expression.value ? null : "false",
        reported: false,
        references: [],
        literal: { text: expression.value ? name : `${name}="false"`, rewritable: true },
      };
    }
    return undefined;
  }
  const number =
    expression.type === "Literal" && typeof expression.value === "number"
      ? expression.value
      : expression.type === "UnaryExpression" &&
          expression.operator === "-" &&
          expression.argument.type === "Literal" &&
          typeof expression.argument.value === "number"
        ? -expression.argument.value
        : undefined;
  if (
    number === undefined ||
    boolean ||
    (namespace === "html" && isStringOnlyAttribute(tag, name))
  ) {
    return undefined;
  }
  const digits = String(number);
  return {
    kind: "static",
    value: digits,
    reported: false,
    references: [],
    literal: { text: `${name}="${digits}"`, rewritable: Number.isFinite(number) },
  };
}

/**
 * Whether a static string reads the same written as a JSX attribute string: no `&` (JSX decodes
 * references there), no `"`, no line break, and no escape.
 */
function rewritable(node: StaticString, source: string): boolean {
  return (
    !/[&"\n\r\u2028\u2029]/.test(valueOf(node)) &&
    piecesOf(node, source).every((piece) => !piece.reference)
  );
}

/** The ARIA attributes whose value is text or ids (`aria-label`, `aria-controls`), with what they take. */
const ARIA_TEXT: ReadonlyMap<string, string> = new Map(
  [...ARIA_TYPES].flatMap(([name, { type }]): [string, string][] =>
    type === "string"
      ? [[name, "text"]]
      : type === "id"
        ? [[name, "an id"]]
        : type === "idlist"
          ? [[name, "a list of ids"]]
          : [],
  ),
);

/** The attributes that render a boolean as `"true"` or `"false"` (ADR-0037). */
function trueFalseAttribute(name: string): boolean {
  return (
    name.startsWith("aria-") ||
    name === "contenteditable" ||
    name === "draggable" ||
    name === "spellcheck"
  );
}

/**
 * Reads an attribute string and reports what in it the targets cannot render alike: what JSX
 * implementations decode differently (UF3009), and characters HTML would not keep (UF3010).
 * The ASCII whitespace of a `class` separates its names, so none of it is rendered.
 */
function readValue(
  name: string,
  literal: AST.StringLiteral,
  reporter: Reporter,
): { value: string; reported: boolean; pieces: Piece[] } {
  const raw = literal.value;
  const reading = readJsxAttribute(raw);
  // The raw text starts after the opening quote.
  const at: RawSpan = (range) => ({
    start: literal.start + 1 + range.start,
    end: literal.start + 1 + range.end,
  });
  for (const divergence of reading.divergences) reportDivergence(divergence, at, reporter);
  const rendered =
    name === "class"
      ? reading.kept.filter((piece) => !ASCII_WHITESPACE.test(piece.value))
      : reading.kept;
  const characters = unportableCharacters(raw, rendered, reading.divergences);
  for (const character of characters) reportCharacter(character, at, reporter);
  return {
    value: reading.value,
    reported: reading.divergences.length > 0 || characters.length > 0,
    pieces: reading.kept.map((piece) => ({
      ...piece,
      start: literal.start + 1 + piece.start,
      end: literal.start + 1 + piece.end,
    })),
  };
}

/** HTML's ASCII whitespace: what separates the names in a `class`. */
const ASCII_WHITESPACE = /^[\t\n\f\r ]+$/;

/**
 * Reads a spread (ADR-0039): an object literal is written as its attributes (UF3004); any other
 * value must be a prop or an item whose type the module declares, whose keys it renders exactly,
 * each checked as a bound attribute of the element, and read through `?.` where the value may be
 * nullish (`./spread-source.ts`). A type that declares no keys, or a source that is absent
 * wherever the spread renders, renders nothing (UF3004, removed). `after` is where the source
 * before it ends.
 */
function readSpread(
  item: AST.JSXSpreadAttribute,
  after: number,
  opening: AST.JSXOpeningElement,
  element: ElementContext,
): SpreadRead {
  const { render, tag, namespace } = element;
  const { reporter } = render;
  const argument = item.argument;
  if (argument.type === "ObjectExpression") {
    objectSpread(item, argument, opening, element);
    const binds = argument.properties.some(
      (property) => property.type !== "Property" || !isStaticString(property.value),
    );
    return { node: item, binds, attribute: undefined, keys: [] };
  }
  const mark = reporter.diagnostics.length;
  const checked = checkExpression(argument, render);
  const shape = declaredShapeOf(checked.kinds);
  if (!shape) {
    if (checked.clean) {
      reporter.unsupported(
        item,
        "Spreads of objects whose keys the compiler cannot see are not supported yet: they land with fallthrough (M3).",
        {
          help: "Spread a prop or a list's item typed by an interface or an object type the module declares, or write the attributes.",
        },
      );
    }
    return { node: item, binds: true, attribute: undefined, keys: [] };
  }
  const removal = (): Fix[] =>
    checked.clean && !reporter.hasErrorsSince(mark)
      ? [
          {
            title: "Remove the spread",
            confidence: "safe",
            edits: [{ span: { start: after, end: item.end }, text: "" }],
          },
        ]
      : [];
  if (!shape.members().size) {
    // It binds nothing, so it leaves an element Angular writes as literal (ADR-0037) as it is.
    reporter.report("UF3004", item, "This spread renders nothing: its type declares no keys.", {
      help: "Remove the spread.",
      fixes: removal(),
    });
    return { node: item, binds: false, attribute: undefined, keys: [] };
  }
  // Whether the source may be nullish here, once the conditions around the spread narrow it:
  // the targets then read each key through `?.`.
  const source = spreadSource(item, checked.kinds, render);
  if (source.kind === "absent") {
    reporter.report(
      "UF3004",
      item,
      "This spread renders nothing: a condition around it holds only where its source is absent.",
      {
        help: "Remove the spread.",
        related: [{ span: span(source.condition), message: "The condition tests the source here" }],
        fixes: removal(),
      },
    );
    return { node: item, binds: false, attribute: undefined, keys: [] };
  }
  if (source.kind === "unfollowed") {
    reporter.report("UF1002", item, source.message, {
      help: source.help,
      related: [{ span: span(source.condition), message: "The condition tests the source here" }],
    });
  }
  // An unfollowed source checks its keys as though it may be nullish, as its type says.
  const nullish = source.kind !== "read" || source.nullish;
  const keys: SpreadKey[] = [];
  const read: { name: string; key: Span }[] = [];
  for (const [authored, member] of shape.members()) {
    const related = [{ span: member.key, message: "The spread's type declares the key here" }];
    const name = canonicalName(tag, namespace, authored);
    const problem: Problem | undefined =
      name === "key" || name === "ref" || name === "children"
        ? unsupported(
            `A spread's \`${name}\` key is not supported yet: the frameworks read \`${name}\` themselves, which lands with composition (M3).`,
          )
        : name === "style"
          ? unsupported("A spread's `style` key is not supported yet: it lands in M4.")
          : name !== authored
            ? {
                code: "UF3004",
                message: `The spread's key \`${authored}\` is written \`${name}\`: a spread's keys are attribute names.`,
                help: "Rename the member in its type.",
              }
            : nameProblem(tag, namespace, authored, name, true);
    if (problem) {
      report(reporter, item, problem, related);
      continue;
    }
    const kinds = member.optional || nullish ? union(member.kinds(), UNDEFINED) : member.kinds();
    const bound =
      name === "class" ? classKeyProblem(kinds) : boundValueProblem(tag, namespace, name, kinds);
    if (bound) {
      report(reporter, item, bound, related);
      continue;
    }
    keys.push(createSpreadKey(name, member.key));
    read.push({ name, key: member.key });
  }
  return {
    node: item,
    binds: true,
    attribute: reporter.hasErrorsSince(mark)
      ? undefined
      : createSpreadAttribute(checked.expression, keys, nullish, span(item)),
    keys: read,
  };
}

/** A spread's `class` key merges with the element's class: a string, or nothing. */
function classKeyProblem(kinds: Kinds): Problem | undefined {
  const outsideKinds = outside(kinds, ["string", "null", "undefined"]);
  return outsideKinds.length
    ? {
        code: "UF3018",
        message: `A spread's \`class\` key merges with the element's class, and can be ${describe(outsideKinds)}, which the targets render differently.`,
        help: "Type the key as a string.",
      }
    : undefined;
}

/**
 * A spread of an object literal is written as its attributes (UF3004). The fix writes them where
 * each is a name the element takes and a value written canonically, and nothing in the object
 * was reported.
 */
function objectSpread(
  item: AST.JSXSpreadAttribute,
  object: AST.ObjectExpression,
  opening: AST.JSXOpeningElement,
  element: ElementContext,
): void {
  const { render, tag, namespace } = element;
  const { reporter, source } = render;
  const mark = reporter.diagnostics.length;
  const written = new Set(
    opening.attributes.flatMap((attribute) =>
      attribute.type === "JSXAttribute" && attribute.name.type === "JSXIdentifier"
        ? [canonicalName(tag, namespace, attribute.name.name)]
        : [],
    ),
  );
  const attributes: string[] = [];
  // Another spread's keys are not known here: the attributes written out could clash with them.
  let fixable = opening.attributes.every(
    (attribute) => attribute === item || attribute.type === "JSXAttribute",
  );
  for (const property of object.properties) {
    if (
      property.type !== "Property" ||
      property.computed ||
      property.method ||
      property.kind !== "init" ||
      property.shorthand
    ) {
      fixable = false;
      if (property.type === "SpreadElement") checkExpression(property.argument, render);
      continue;
    }
    const key = property.key;
    const authored =
      key.type === "Identifier"
        ? key.name
        : key.type === "Literal" && typeof key.value === "string"
          ? key.value
          : undefined;
    const name = authored === undefined ? undefined : canonicalName(tag, namespace, authored);
    const value = property.value;
    if (
      authored === undefined ||
      name !== authored ||
      name === "key" ||
      name === "class" ||
      name === "style" ||
      written.has(name) ||
      nameProblem(tag, namespace, authored, name, true)
    ) {
      fixable = false;
      checkExpression(value, render);
      continue;
    }
    written.add(name);
    if (isStaticString(value)) {
      if (!rewritable(value, source)) fixable = false;
      attributes.push(`${name}="${valueOf(value)}"`);
      continue;
    }
    const checked = checkExpression(value, render);
    if (!checked.clean || boundValueProblem(tag, namespace, name, checked.kinds)) fixable = false;
    if (
      value.type === "Literal" ||
      value.type === "UnaryExpression" ||
      value.type === "Identifier"
    ) {
      // A literal would be written as a static attribute, which this fix does not decide.
      if (value.type !== "Identifier" || value.name === "undefined") fixable = false;
    }
    attributes.push(`${name}={${source.slice(value.start, value.end)}}`);
  }
  const fixes: Fix[] =
    fixable && !reporter.hasErrorsSince(mark)
      ? [
          {
            title: "Write the attributes",
            confidence: "safe",
            edits: [{ span: span(item), text: attributes.join(" ") }],
          },
        ]
      : [];
  reporter.report(
    "UF3004",
    item,
    "A spread of an object literal is written as its attributes: each attribute is written once, in one way.",
    { help: "Write the attributes themselves.", fixes },
  );
}

/**
 * Checks each attribute against its element and the others, reports what is set twice, and
 * lowers what is accepted.
 */
function checkAgainstElement(
  entries: readonly (Read | SpreadRead)[],
  element: ElementContext,
): Attribute[] {
  const { tag, namespace, hasChildren } = element;
  const { reporter } = element.render;
  const reads = entries.filter((entry): entry is Read => "form" in entry);
  // How many attributes and spread keys set each name: a fix that renames or removes one is
  // offered only where it changes no duplicate (a spread's `class` merges with the element's).
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const names =
      "form" in entry
        ? [entry.name]
        : entry.keys.map((key) => key.name).filter((name) => name !== "class");
    for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  // `type` is an enumerated attribute, so its keywords are case-insensitive. A bound `type`
  // leaves it unknown.
  const typeRead = reads.find((read) => read.name === "type");
  const type =
    typeRead?.form.kind === "static" ? (typeRead.form.value?.toLowerCase() ?? "") : undefined;
  const staticType = typeRead === undefined || typeRead.form.kind === "static";

  const attributes: Attribute[] = [];
  const firsts = new Map<string, Span>();
  let ownClass: Span | undefined;
  let spreadClass: Span | undefined;
  /** Claims a name for an attribute, or reports it set twice (UF3007). */
  const claim = (name: string, at: Span, nameAt: Span, fromSpread: boolean): boolean => {
    let first: Span | undefined;
    if (name === "class") {
      first = fromSpread ? spreadClass : ownClass;
      if (!first) {
        if (fromSpread) spreadClass = at;
        else ownClass = at;
      }
    } else {
      first = firsts.get(name);
      if (!first) firsts.set(name, at);
    }
    if (!first) return true;
    reporter.report("UF3007", nameAt, `\`${name}\` is set twice on this <${tag}>.`, {
      help: fromSpread
        ? "Keep one: remove the attribute, or the key from the spread's type."
        : "Keep one: the targets disagree about which value wins.",
      related: [{ span: first, message: "First set here" }],
    });
    return false;
  };

  for (const entry of entries) {
    if (!("form" in entry)) {
      let accepted = true;
      for (const key of entry.keys) {
        if (!claim(key.name, span(entry.node), span(entry.node), true)) accepted = false;
        const problem = elementProblem(tag, namespace, key.name, type, staticType, hasChildren);
        if (problem) {
          report(reporter, entry.node, problem, [
            { span: key.key, message: "The spread's type declares the key here" },
          ]);
          accepted = false;
        }
      }
      if (accepted && entry.attribute) attributes.push(entry.attribute);
      continue;
    }
    const { name, form, nameNode, node } = entry;
    if (!claim(name, span(nameNode), span(nameNode), false)) {
      if (form.kind === "static") reportReferences(entry, false, reporter);
      continue;
    }
    // Messages name the attribute by its HTML name, so they read the same once a rename is
    // applied: fixing one problem never changes another's message. A fix that removes the
    // attribute leaves no name to rename, and its edits would overlap the rename's.
    const unique = counts.get(name) === 1;
    const mark = reporter.diagnostics.length;
    const elementFound = elementProblem(tag, namespace, name, type, staticType, hasChildren);
    const found =
      elementFound ??
      (form.kind === "static"
        ? valueProblem(tag, namespace, entry, form.value, unique)
        : form.kind === "bound"
          ? boundValueProblem(tag, namespace, name, form.value.kinds)
          : undefined);
    const removes = found?.fixes?.some((fix) =>
      fix.edits.some((edit) => edit.span.start <= nameNode.start && edit.span.end >= nameNode.end),
    );
    const renamed = removes ? undefined : caseProblem(entry, namespace, unique);
    if (found) {
      // A bound value's kind is reported at the value; anything about the name, at the name.
      const atValue =
        form.kind === "bound" && elementFound === undefined && found.code !== "UF1002";
      report(reporter, atValue ? form.value.expression.span : nameNode, found);
    }
    if (renamed) report(reporter, nameNode, renamed);
    if (
      form.kind === "static" ||
      form.kind === "absent" ||
      (form.kind === "style" && form.literal)
    ) {
      literalProblem(entry, found, renamed, unique, element.render.source, reporter);
    } else if (form.kind === "class") {
      classForm(entry, form, found !== undefined || renamed !== undefined, unique, reporter);
    } else if (form.kind === "style" && form.lowered.empty) {
      // A removal beside another `style` would change which one is set twice.
      const fixable = !found && !renamed && unique;
      reporter.report(
        "UF3022",
        nameNode,
        "This `style` sets nothing: a style without declarations renders as no `style` attribute.",
        {
          help: "Remove it.",
          fixes: fixable
            ? [
                {
                  title: "Remove the empty `style`",
                  confidence: "safe",
                  edits: [{ span: { start: entry.after, end: node.end }, text: "" }],
                },
              ]
            : [],
        },
      );
    }
    const accepted =
      !reporter.hasErrorsSince(mark) &&
      !(form.kind === "static" && form.reported) &&
      !(form.kind === "bound" && !form.value.clean);
    if (form.kind === "static" && form.references.length) {
      // Their fix is offered where the attribute is accepted, before it and after it.
      const fixed = referencesFixed(entry);
      reportReferences(
        entry,
        accepted && !valueProblem(tag, namespace, entry, fixed, unique),
        reporter,
      );
    }
    if (!accepted) continue;
    switch (form.kind) {
      case "static":
        attributes.push(
          createStaticAttribute(name, loweredValue(name, namespace, form.value), span(node)),
        );
        break;
      case "bound":
        attributes.push(createBoundAttribute(name, form.value.expression, span(node)));
        break;
      case "class":
        if (form.lowered.attribute)
          attributes.push({ ...form.lowered.attribute, span: span(node) });
        break;
      case "style":
        if (form.lowered.attribute)
          attributes.push({ ...form.lowered.attribute, span: span(node) });
        break;
      case "absent":
        break;
    }
  }
  return attributes;
}

/**
 * The canonical spelling of a literal in braces (UF3004). A problem whose fix rewrites the value
 * makes it moot; otherwise it is reported, with a fix where it is the only edit on the
 * attribute and keeps the value (a removal hides any other problem of the attribute, so it is
 * offered only where there is none).
 */
function literalProblem(
  entry: Read,
  found: Problem | undefined,
  renamed: Problem | undefined,
  unique: boolean,
  source: string,
  reporter: Reporter,
): void {
  const { form, name, node, nameNode, after } = entry;
  const literal =
    form.kind === "static" || form.kind === "absent" || form.kind === "style"
      ? form.literal
      : undefined;
  if (!literal || (form.kind !== "absent" && !literal.rewritable) || found?.fixes?.length) return;
  const removal = literal.text === undefined;
  const fixable = !renamed?.fixes?.length && !(removal && (found || renamed || !unique));
  const written = source.slice(node.value!.start, node.value!.end);
  const fix: Fix | undefined = !fixable
    ? undefined
    : removal
      ? {
          title: `Remove \`${name}\``,
          confidence: "safe",
          edits: [{ span: { start: after, end: node.end }, text: "" }],
        }
      : {
          title: `Write \`${literal.text}\``,
          confidence: "safe",
          edits: [
            {
              span: { start: nameNode.end, end: node.end },
              text: literal.text!.slice(name.length),
            },
          ],
        };
  reporter.report(
    "UF3004",
    nameNode,
    removal
      ? `\`${name}=${written}\` renders no attribute, so it is written as none.`
      : `\`${name}=${written}\` is a literal: it is written \`${literal.text}\`.`,
    { ...(removal ? { help: "Remove the attribute." } : {}), fixes: fix ? [fix] : [] },
  );
}

/**
 * A `class` whose parts are all static is written `class="a b"` (UF3004), or, with no names,
 * as none; the fix writes it, where nothing in it was reported.
 */
function classForm(
  entry: Read,
  form: Extract<Form, { kind: "class" }>,
  problems: boolean,
  unique: boolean,
  reporter: Reporter,
): void {
  const { names, reported } = form.lowered;
  // A problem in a part may be fixed into a dynamic one: the class is static only without one.
  if (!names || reported) return;
  const fixable = !problems;
  if (!names.length) {
    reporter.report(
      "UF3004",
      entry.nameNode,
      "This `class` has no class names: Vue renders it empty, and the others leave it out.",
      {
        help: "Remove it.",
        fixes:
          fixable && unique
            ? [
                {
                  title: "Remove the empty `class`",
                  confidence: "safe",
                  edits: [{ span: { start: entry.after, end: entry.node.end }, text: "" }],
                },
              ]
            : [],
      },
    );
    return;
  }
  const text = `"${names.join(" ")}"`;
  reporter.report(
    "UF3004",
    entry.nameNode,
    `This \`class\` is static: it is written \`class=${text}\`.`,
    {
      fixes:
        fixable && !names.some((name) => /["&]/.test(name))
          ? [
              {
                title: `Write \`class=${text}\``,
                confidence: "safe",
                edits: [{ span: span(form.container), text }],
              },
            ]
          : [],
    },
  );
}

/**
 * An attribute not written with its HTML or SVG name. The rename is offered only when it
 * cannot create a duplicate (`className` beside `class`).
 */
function caseProblem(read: Read, namespace: Namespace, unique: boolean): Problem | undefined {
  const { name, authored, nameNode } = read;
  if (authored === name) return undefined;
  return {
    code: "UF3004",
    message:
      authored === "xlink:href" || authored === "xlinkHref"
        ? `\`${authored}\` is written \`href\`: SVG 2 dropped XLink, and every target renders \`href\`.`
        : namespace === "svg"
          ? `\`${authored}\` is written \`${name}\`: SVG elements take SVG's attribute names, in SVG's own case.`
          : `\`${authored}\` is written \`${name}\`: elements take HTML's attribute names, in lower case.`,
    fixes: unique
      ? [
          {
            title: `Rename \`${authored}\` to \`${name}\``,
            confidence: "safe",
            edits: [{ span: span(nameNode), text: name }],
          },
        ]
      : [],
  };
}

/** Reports the references only HTML decodes in an attribute's value (UF3011). */
function reportReferences(attribute: Read, fixable: boolean, reporter: Reporter): void {
  const { form } = attribute;
  if (form.kind !== "static" || !form.references.length) return;
  const start = attribute.node.value!.start + 1;
  const at: RawSpan = (range) => ({ start: start + range.start, end: start + range.end });
  for (const reference of form.references) {
    reportHtmlOnlyReference(reference, at, fixable, reporter);
  }
}

/** An attribute's value with every reference only HTML decodes written as a numeric one. */
function referencesFixed(attribute: Read): string | null {
  const { form } = attribute;
  if (form.kind !== "static") return null;
  let raw = (attribute.node.value as AST.StringLiteral).value;
  for (const reference of form.references.toReversed()) {
    raw = raw.slice(0, reference.start) + reference.numeric + raw.slice(reference.end);
  }
  return readJsxAttribute(raw).value;
}

/** A `class` value's names, separated by single spaces, as Vue, Svelte and Angular render it. */
function classNames(value: string): string {
  return value
    .split(/[\t\n\f\r ]+/)
    .filter(Boolean)
    .join(" ");
}

/** The value an accepted static attribute lowers to (see `StaticAttribute.value`). */
function loweredValue(name: string, namespace: Namespace, value: string | null): string | true {
  if (value === null) return namespace === "html" && isBooleanAttribute(name) ? true : "true";
  return name === "class" ? classNames(value) : value;
}

/** The attributes that override the form's submission, allowed only on submit buttons. */
const SUBMISSION_OVERRIDES: ReadonlySet<string> = new Set(
  "formaction formenctype formmethod formnovalidate formtarget".split(" "),
);

/**
 * Problems that depend on the element: its type, its children. State attributes and editable
 * content are what the targets render differently (`checkInvariants` rejects them too), bound
 * or static; the submission overrides are valid HTML that does nothing where it is written, as
 * far as a static `type` tells.
 */
function elementProblem(
  tag: string,
  namespace: Namespace,
  name: string,
  type: string | undefined,
  staticType: boolean,
  hasChildren: boolean,
): Problem | undefined {
  if (namespace !== "html") return undefined;
  if (isStateAttribute(tag, name, type)) {
    return name === "muted"
      ? unsupported(`\`muted\` on <${tag}> is not supported yet: ${MUTED_REASON}`)
      : formState(tag, name);
  }
  if (SUBMISSION_OVERRIDES.has(name) && staticType) {
    // A button's missing or invalid `type` is the Submit Button state; an input's is Text.
    const submits =
      tag === "button"
        ? type !== "button" && type !== "reset"
        : type === "submit" || type === "image";
    if (!submits) {
      return {
        code: "UF3006",
        message: `\`${name}\` only applies to a submit button, and this <${tag}> is not one.`,
        help:
          tag === "button"
            ? 'Remove it, or make the button `type="submit"`.'
            : 'Remove it, or make the input `type="submit"` or `type="image"`.',
      };
    }
  }
  const childless = CHILDLESS_ATTRIBUTES.get(name);
  if (childless && hasChildren) {
    return unsupported(
      `Editable content (\`${name}\` with children) is not supported yet: ${childless}`,
    );
  }
  return undefined;
}

/**
 * Problems with a bound value (ADR-0037): attributes that cannot be bound (Angular's, and
 * those deciding a `<select>`'s first selection) or whose `false` renders as `"false"` somewhere
 * (UF1002), and kinds of value the attribute does not render
 * alike on every target (UF3018). `unknown` is accepted.
 */
export function boundProblem(
  tag: string,
  namespace: Namespace,
  name: string,
  kinds: Kinds,
): Problem | undefined {
  if (namespace === "html") {
    const unbindable = unbindableAttribute(tag, name);
    if (unbindable) {
      return unsupported(
        `A bound \`${name}\` on <${tag}> is not supported yet: ${unbindable}`,
        "Write a static value.",
      );
    }
    const nullish = name === "value" ? NULLISH_VALUE_ELEMENTS.get(tag) : undefined;
    if (nullish && (has(kinds, "null") || has(kinds, "undefined"))) {
      return unsupported(
        `A bound \`value\` on <${tag}> that may be null or undefined is not supported yet: ${nullish}`,
        `Render the element only where the value is there, as in \`{value != null && ${tag === "input" ? "<input value={value} />" : `<${tag} value={value}>…</${tag}>`}}\`, or give it a fallback, as in \`value={value ?? ${tag === "li" || tag === "meter" || tag === "progress" ? "0" : '""'}}\`.`,
      );
    }
    if (isBooleanAttribute(name) && !BINDABLE_BOOLEAN_ATTRIBUTES.has(name)) {
      return unsupported(
        `Binding \`${name}\` is not supported yet: Vue's server and Svelte render a false \`${name}\` as "false", as they do not read it as a boolean.`,
        "Write it statically, or render the element in a conditional.",
      );
    }
  }
  let allowed: Primitive[];
  let message: (kinds: string) => string;
  let help: string;
  if (namespace === "html" && isBooleanAttribute(name)) {
    allowed = ["boolean", "null", "undefined"];
    message = (can) =>
      `\`${name}\` is on or off, and this value can be ${can}, which the targets read differently.`;
    help = "Bind a boolean: `cond`, or `value !== undefined`.";
  } else if (isNumberTypedAttribute(namespace === "html" ? tag : "", name)) {
    allowed = ["number", "null", "undefined"];
    message = (can) => `React and Qwik type \`${name}\` as a number, and this value can be ${can}.`;
    help = "Bind a number: `Number(value)`.";
  } else if (ARIA_TEXT.has(name)) {
    allowed = ["string", "null", "undefined"];
    message = (can) =>
      `\`${name}\` takes ${ARIA_TEXT.get(name)}, which the targets' types declare as a string, and this value can be ${can}.`;
    help = "Bind a string: `String(value)`.";
  } else if (trueFalseAttribute(name)) {
    allowed = ["string", "number", "boolean", "null", "undefined"];
    message = (can) =>
      `\`${name}\` renders its value as text, and this value can be ${can}, which the targets render differently.`;
    help = "Bind a string, a number or a boolean.";
  } else if (namespace === "html" && isStringOnlyAttribute(tag, name)) {
    allowed = ["string", "null", "undefined"];
    message = (can) =>
      `The authoring types declare \`${name}\` as a string, which React's, Solid's and Qwik's types check, and this value can be ${can}.`;
    help = "Bind a string: `String(value)`.";
  } else if (isTargetStringAttribute(tag, namespace, name)) {
    allowed = ["string", "null", "undefined"];
    message = (can) =>
      `Some targets' types declare \`${name}\` as a string only, and this value can be ${can}.`;
    help = "Bind a string: `String(value)`.";
  } else {
    allowed = ["string", "number", "null", "undefined"];
    message = (can) =>
      `\`${name}\` renders its value as text, and this value can be ${can}: Qwik drops \`false\` there and React drops it on some attributes, where the others render "false".`;
    help = "Bind a string or a number: `String(value)`.";
  }
  const out = outside(kinds, allowed);
  return out.length ? { code: "UF3018", message: message(describe(out)), help } : undefined;
}

/**
 * Everything wrong with a bound value or a spread's key: its kinds, then the values ARIA defines
 * (UF3008), then the tokens an enumerated attribute's types accept on every target (UF3018).
 * The conformance tests check what it accepts against the targets' element types.
 */
export function boundValueProblem(
  tag: string,
  namespace: Namespace,
  name: string,
  kinds: Kinds,
): Problem | undefined {
  return (
    boundProblem(tag, namespace, name, kinds) ??
    ariaBindingProblem(name, kinds) ??
    enumeratedProblem(tag, namespace, name, kinds)
  );
}

/**
 * A bound ARIA attribute or `role` whose value can only be literals: each must be a value ARIA
 * defines (UF3008), as a static one must.
 */
function ariaBindingProblem(name: string, kinds: Kinds): Problem | undefined {
  if (!name.startsWith("aria-") && name !== "role") return undefined;
  const values: string[] = [];
  for (const primitive of kinds.primitives) {
    if (primitive === "string" && kinds.strings) values.push(...kinds.strings);
    else if (primitive === "boolean" && kinds.booleans)
      values.push(...[...kinds.booleans].map(String));
    else if (primitive !== "null" && primitive !== "undefined") return undefined;
  }
  for (const value of values) {
    const problem = name === "role" ? roleProblem(value) : ariaValueProblem(name, value);
    if (problem) {
      return {
        code: "UF3008",
        message:
          name === "role"
            ? `This \`role\` can be "${value}": ${problem}.`
            : `\`${name}\` takes ${problem}, and this value can be "${value}".`,
        help: "Bind only values ARIA defines.",
      };
    }
  }
  return undefined;
}

/**
 * Problems with a static value: its form, values the targets render differently, and code or a
 * document the compiler cannot analyse.
 */
function valueProblem(
  tag: string,
  namespace: Namespace,
  attribute: Read,
  value: string | null,
  unique: boolean,
): Problem | undefined {
  const { name, node } = attribute;
  if (namespace === "html" && isBooleanAttribute(name)) {
    if (value === null) return undefined;
    if (name === "hidden" && value.toLowerCase() === "until-found") {
      return {
        code: "UF3008",
        message: '`hidden="until-found"` is not supported: React renders `hidden` as a boolean.',
      };
    }
    const redundant = value === "" || value.toLowerCase() === name;
    return {
      code: "UF3004",
      message: redundant
        ? `\`${name}\` is a boolean attribute: write it without a value.`
        : `\`${name}\` is a boolean attribute: it is on whenever it is present, so \`${name}="${value}"\` is on too.`,
      help: redundant ? undefined : "Write it without a value to turn it on, or remove it.",
      fixes: redundant
        ? [
            {
              title: `Write \`${name}\` without a value`,
              confidence: "safe",
              edits: [{ span: { start: attribute.nameNode.end, end: node.end }, text: "" }],
            },
          ]
        : [],
    };
  }
  if (value === null) {
    if (TRUE_VALUED_ATTRIBUTES.has(name) || isDataAttribute(name)) return undefined;
    // HTML reads a bare attribute as the empty string, so that is the likely meaning, written as
    // the keyword HTML reads it as where the targets' types take no empty value
    // (`popover="auto"`). The fix is offered only where the compiler accepts the value (not
    // `src=""` or `rows=""`).
    const empty = emptyValue(tag, namespace, name);
    const fixable = !valueProblem(tag, namespace, attribute, empty, unique);
    return {
      code: "UF3004",
      message: `\`${name}\` needs a value: in JSX an attribute without one means the string "true".`,
      help: `Write the value, such as \`${name}="${empty}"\`.`,
      fixes: fixable
        ? [
            {
              title: `Write \`${name}="${empty}"\``,
              confidence: "likely",
              edits: [
                {
                  span: { start: attribute.nameNode.end, end: attribute.nameNode.end },
                  text: `="${empty}"`,
                },
              ],
            },
          ]
        : [],
    };
  }
  const generated = generatedIdProblem(name, value);
  if (generated) return generated;
  if (name === "class") return classProblem(attribute, value, unique);
  const unanalysable = unanalysableUrl(tag, name, value);
  if (unanalysable === "javascript") {
    return {
      code: "UF3008",
      message: `\`${name}\` runs a \`javascript:\` URL: React blocks these, and the compiler cannot analyse the code.`,
      help: "Run code from an event handler.",
    };
  }
  if (unanalysable === "data") {
    return {
      code: "UF3008",
      message: `<${tag}> loads its \`${name}\` as a document, and the compiler cannot analyse one written in a \`data:\` URL.`,
      help: "Load the document from another URL, or write its markup in the component.",
    };
  }
  if (isDroppedEmptyUrl(tag, name, value)) {
    return {
      code: "UF3008",
      message: `An empty \`${name}\` is not supported: React drops it and warns.`,
      help: "Remove the attribute, or give it a URL.",
    };
  }
  const numeric = namespace === "html" ? NUMERIC_ATTRIBUTES.get(tag)?.get(name) : undefined;
  if (numeric) {
    const problem = numberProblem(attribute, value, numeric);
    if (problem) return problem;
  }
  if (name.startsWith("aria-")) {
    const expected = ariaValueProblem(name, value);
    if (expected) {
      return {
        code: "UF3008",
        message: `\`${name}\` takes ${expected}, and "${value}" is not one.`,
        help: "Write a value ARIA defines: assistive technology ignores any other.",
      };
    }
  }
  if (name === "role") {
    const problem = roleProblem(value);
    if (problem) {
      return {
        code: "UF3008",
        message: `This \`role\` is not one assistive technology knows: ${problem}.`,
        help: "Write one of ARIA's roles, or remove the attribute.",
      };
    }
  }
  if (isNumberTypedAttribute(namespace === "html" ? tag : "", name)) {
    return numberTypedProblem(attribute, value);
  }
  return enumeratedStaticProblem(
    tag,
    namespace,
    name,
    value,
    node.value ? span(node.value) : undefined,
  );
}

/**
 * A value of an attribute React and Qwik type as a number (ADR-0037): they write it as a number
 * literal, so it must be a finite number, in the form `String(Number(value))` gives.
 */
function numberTypedProblem(attribute: Read, value: string): Problem | undefined {
  const { name } = attribute;
  const number = Number(value);
  if (value.trim() === "" || !Number.isFinite(number)) {
    return {
      code: "UF3008",
      message: `React and Qwik type \`${name}\` as a number, which they write as a number literal, and "${value}" is not one.`,
      help: "Write a number.",
    };
  }
  const canonical = String(number);
  if (canonical === value) return undefined;
  return {
    code: "UF3004",
    message: `\`${name}="${value}"\` is written \`${name}="${canonical}"\`: React and Qwik write it as the number literal \`${canonical}\`.`,
    fixes: [
      {
        title: `Write ${canonical}`,
        confidence: "safe",
        edits: [{ span: span(attribute.node.value!), text: `"${canonical}"` }],
      },
    ],
  };
}

/**
 * An authored id, or a reference to one, that starts with the generated-id prefix. The tests
 * recognise generated ids by that prefix alone (every target's `useId` writes it), so an
 * authored one would be renamed like a generated id and could hide a real difference. The
 * references are read as the tests' normaliser reads them (`idReferencesIn`): in `id` and the
 * idref attributes, in a `#id` URL, and in `url(#id)` in any other value.
 */
function generatedIdProblem(name: string, value: string): Problem | undefined {
  const reserved = idReferencesIn(name, value).find((id) => id.startsWith(GENERATED_ID_PREFIX));
  if (!reserved) return undefined;
  return {
    code: "UF3005",
    message: `\`${reserved}\` is reserved: ids starting with \`${GENERATED_ID_PREFIX}\` are the ones the compiler generates.`,
    help: "Choose an id with another prefix.",
  };
}

/**
 * A `class` with no names, which Vue renders as `class=""` and Svelte and Angular leave out,
 * with a name holding whitespace that is not ASCII's, which Angular splits at (it reads
 * names with JavaScript's `\s`) and Vue and Svelte keep in the name, or with a name twice.
 */
function classProblem(attribute: Read, value: string, unique: boolean): Problem | undefined {
  const { node } = attribute;
  if (!classNames(value)) {
    return {
      code: "UF3004",
      message:
        "This `class` has no class names: Vue renders it empty, and the others leave it out.",
      help: "Remove it.",
      fixes: unique
        ? [
            {
              title: "Remove the empty `class`",
              confidence: "safe",
              edits: [{ span: { start: attribute.after, end: node.end }, text: "" }],
            },
          ]
        : [],
    };
  }
  const space = /[^\S\t\n\f\r ]/.exec(value)?.[0];
  if (space !== undefined) {
    const code = `U+${space.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
    return {
      code: "UF3008",
      message: `A class name holds whitespace (${code}): Angular splits names there, and the other targets keep it in the name.`,
      help: "Separate class names with spaces, and keep other whitespace out of them.",
    };
  }
  // Angular merges a static `class` with a bound one (a spread's) through the class list, which
  // drops a repeated name the other targets keep, as a `class={…}` part's (UF3007).
  const names = classNames(value).split(" ");
  const repeated = names.find((name, index) => names.indexOf(name) !== index);
  if (repeated === undefined) return undefined;
  const { form } = attribute;
  const once = [...new Set(names)].join(" ");
  const text = `"${once}"`;
  // The fix writes the whole value, a literal in braces included; nothing else may edit it.
  const fixable =
    form.kind === "static" && !form.reported && !form.references.length && !/["&]/.test(once);
  return {
    code: "UF3007",
    message: `The class \`${repeated}\` is listed twice in this \`class\`.`,
    help: "List it once.",
    fixes: fixable
      ? [
          {
            title: `Write \`class=${text}\``,
            confidence: "safe",
            edits: [{ span: { start: attribute.nameNode.end, end: node.end }, text: `=${text}` }],
          },
        ]
      : [],
  };
}

const NUMBER_NAMES: Readonly<Record<NumberKind, string>> = {
  integer: "an integer",
  "non-negative-integer": "a non-negative integer",
  "positive-integer": "a positive integer",
  number: "a number",
};

/**
 * A numeric attribute's value must be a number of its kind, in range and in canonical form:
 * renderers that set the DOM property (Vue) or parse the number (React) rewrite or drop any
 * other spelling (`canonicalNumber`). A number in HTML's syntax but not canonical (`03`, `1e3`)
 * has a fix.
 */
function numberProblem(
  attribute: Read,
  value: string,
  numeric: { kind: NumberKind; max?: number },
): Problem | undefined {
  const { name, node } = attribute;
  const { kind, max } = numeric;
  const canonical = canonicalNumber(value, numeric);
  if (canonical === undefined) {
    return {
      code: "UF3008",
      message: `\`${name}\` takes ${NUMBER_NAMES[kind]}${max === undefined ? "" : ` up to ${max}`}, and "${value}" is not one.`,
      help: "Renderers that set the DOM property rewrite or reject any other value.",
    };
  }
  if (canonical === value) return undefined;
  return {
    code: "UF3004",
    message: `\`${name}="${value}"\` is written \`${name}="${canonical}"\`: some renderers set it as a DOM property, which rewrites the number.`,
    fixes: [
      {
        title: `Write ${canonical}`,
        confidence: "safe",
        edits: [{ span: span(node.value!), text: `"${canonical}"` }],
      },
    ],
  };
}

function report(
  reporter: Reporter,
  node: { start: number; end: number },
  problem: Problem,
  related?: { span: Span; message: string }[],
  at?: Span,
): void {
  const where = at ?? node;
  if (problem.code === "UF1002") {
    reporter.unsupported(where, problem.message, {
      ...(problem.help ? { help: problem.help } : {}),
      ...(problem.fixes?.length ? { fixes: problem.fixes } : {}),
    });
    return;
  }
  reporter.report(problem.code, where, problem.message, {
    ...(problem.help ? { help: problem.help } : {}),
    ...(problem.fixes?.length ? { fixes: problem.fixes } : {}),
    ...(related?.length ? { related } : {}),
  });
}

/** Whether an attribute is one of the element's, in its namespace. */
export { isAttributeOf };
