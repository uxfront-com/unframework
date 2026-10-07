// The setup an Astro component keeps (ADR-0045, ADR-0046): Astro renders once, on the server,
// with no client runtime, so the frontmatter declares the values the markup reads, in source
// order, and nothing that only the browser would run. A `ref` is its initial value and a
// `computed` its getter's value, each a constant; `const`s and the functions the markup or a
// value calls are copied as written. Listeners, template refs, watchers, effects, lifecycle
// hooks, `emit` and the setup's `let`s never run, and neither does what only they read:
// `liveBindings` keeps exactly what the server render reaches, so nothing the output declares is
// unused (L5).
import {
  functionText,
  liveBindings,
  needsParentheses,
  parseExpression,
  pascalCase,
  rewriteCode,
} from "@unframework/codegen";
import type { LiveOptions } from "@unframework/codegen";
import type {
  BindingId,
  Code,
  DerivedItem,
  FunctionItem,
  IdItem,
  StateItem,
  UfComponent,
} from "@unframework/ir";

import { unreachable } from "./spelling.ts";
import type { Spelling } from "./spelling.ts";

/**
 * What the server render reaches: the markup (but its lists' keys, which Astro does not print)
 * and, through them, the setup's values and functions.
 */
export const SERVER: LiveOptions = { client: false, includeKeys: false };

/** The frontmatter's setup: statements in source order, after the helpers they call. */
export interface SetupCode {
  /** The helpers the statements call, each a statement of its own. */
  helpers: string[];
  /** The setup's statements, in source order. */
  statements: string[];
  /** Whether a helper reads `Astro` (`Astro.locals`). */
  readsAstro: boolean;
}

/** The setup statements of a component's frontmatter, given what the server render reaches. */
export function setupCode(
  component: UfComponent,
  live: ReadonlySet<BindingId>,
  spelling: Spelling,
): SetupCode {
  const helpers: string[] = [];
  const statements: string[] = [];
  let uniqueId: string | undefined;
  for (const item of component.setup) {
    switch (item.kind) {
      case "State":
        if (live.has(item.binding)) statements.push(state(item, component, spelling));
        break;
      case "Derived":
        if (live.has(item.binding)) statements.push(...derived(item, component, spelling));
        break;
      case "Const":
        if (live.has(item.binding)) {
          const type = item.type ? `: ${item.type.code}` : "";
          const value = initialiser(item.value, component, spelling);
          statements.push(`const ${spelling.name(item.binding)}${type} = ${value};`);
        }
        break;
      case "Function":
        if (live.has(item.binding)) statements.push(localFunction(item, component, spelling));
        break;
      case "Id":
        if (live.has(item.binding)) {
          if (uniqueId === undefined) {
            uniqueId = spelling.scope.claim(UNIQUE_ID);
            helpers.push(uniqueIdHelper(uniqueId));
          }
          statements.push(id(item, uniqueId, spelling));
        }
        break;
      case "Variable":
        // A setup `let` holds what client code keeps between runs (a timer's id): no template,
        // getter or initial value reads one (UF2010), so the server render never reaches it.
        if (live.has(item.binding)) {
          const type = item.type ? `: ${item.type.code}` : "";
          const initial = item.initial
            ? ` = ${initialiser(item.initial, component, spelling)}`
            : "";
          statements.push(`let ${spelling.name(item.binding)}${type}${initial};`);
        }
        break;
      case "TemplateRef":
      case "Watch":
      case "WatchEffect":
      case "Lifecycle":
        // Browser-only: an element is never attached on the server, and Astro has no client.
        break;
      default:
        unreachable(item);
    }
  }
  return { helpers, statements, readsAstro: uniqueId !== undefined };
}

/** The bindings the server render reaches. */
export function serverBindings(component: UfComponent): Set<BindingId> {
  return liveBindings(component, SERVER);
}

/**
 * A `ref` as the constant it starts as, typed as the `ref` is (ADR-0046):
 * `const count = 0 as number;`.
 * A `const` keeps a literal's own type (`0`), and TypeScript narrows a `const` declared with a
 * union type to its initial value's member, so either would make the markup's comparisons with
 * other values errors (`count === 5`, TS2367) that the source's `Ref<number>` does not have. So
 * the value is cast: to the type argument (`ref<Status>("idle")`), to `T | undefined` for
 * `ref<T>()`, which starts `undefined`, and to the widened type `ref` infers for a value whose
 * type is a fresh literal (`ref(0)` is a `Ref<number>`, and so is `ref(flag ? 1 : 2)`). Any other
 * value (a prop, an array, an object) has the type `ref` infers for it already, and is copied as
 * it is.
 */
function state(item: StateItem, component: UfComponent, spelling: Spelling): string {
  const name = spelling.name(item.binding);
  if (!item.initial) {
    return `const ${name} = undefined${item.type ? ` as ${unionWithUndefined(item.type.code)}` : ""};`;
  }
  const value = initialiser(item.initial, component, spelling);
  const type = item.type?.code ?? widenedLiteralType(item.initial.code, true);
  return `const ${name} = ${type === undefined ? value : cast(value, type)};`;
}

/**
 * A `computed` as the constant its getter gives (ADR-0046): an expression getter's value, cast
 * as a `ref`'s (`computed<T>`, or a primitive literal); a block getter's body as a local
 * function, called once: `function getTier() {…}` and `const tier = getTier();`. A block getter's
 * return type is the one TypeScript infers for the getter, as `computed`'s type is.
 */
function derived(item: DerivedItem, component: UfComponent, spelling: Spelling): string[] {
  const name = spelling.name(item.binding);
  const { getter } = item;
  if (getter.expression) {
    const value = initialiser(getter.body, component, spelling);
    const type =
      item.type?.code ?? getter.returnType?.code ?? widenedLiteralType(getter.body.code, false);
    return [`const ${name} = ${type === undefined ? value : cast(value, type)};`];
  }
  const fn = spelling.scope.claim(`get${pascalCase(name)}`);
  const typed =
    getter.returnType === undefined && item.type !== undefined
      ? { ...getter, returnType: item.type }
      : getter;
  return [
    functionText(typed, component, spelling.rules, "pure", { name: fn }),
    `const ${name} = ${fn}();`,
  ];
}

/**
 * A setup function the markup or a value calls, as the source declares it: `function format(…)
 * {…}`, or `const format = (…) => …;`. Its summary is pure (UF2014), so it reads only values
 * the server render has.
 */
function localFunction(item: FunctionItem, component: UfComponent, spelling: Spelling): string {
  const name = spelling.name(item.binding);
  switch (item.form) {
    case "declaration":
      return functionText(item.function, component, spelling.rules, "pure", { name });
    case "arrow":
      return `const ${name} = ${functionText(item.function, component, spelling.rules, "pure", { arrow: true })};`;
    default:
      return unreachable(item.form);
  }
}

/** The name the `useId` helper claims (its cell in the capability matrix names it). */
export const UNIQUE_ID = "uniqueId";

/**
 * The `useId` helper (ADR-0049): a counter on `Astro.locals`, which Astro creates for each
 * request and shares between every component the request renders. A module-level counter would
 * grow across requests, and one in the frontmatter would restart for every instance, so two
 * instances on a page would share ids; a random id would differ between renders (P8). The
 * framework's id is the counter, after the prefix every target writes (`uf-id-`).
 */
function uniqueIdHelper(name: string): string {
  return [
    `function ${name}(): string {`,
    "  const locals = Astro.locals as { ufIdCount?: number };",
    "  locals.ufIdCount = (locals.ufIdCount ?? 0) + 1;",
    "  return `uf-id-${locals.ufIdCount}`;",
    "}",
  ].join("\n");
}

/** `const id = useId()`: an id from the helper, unique in the request. */
function id(item: IdItem, helper: string, spelling: Spelling): string {
  return `const ${spelling.name(item.binding)} = ${helper}();`;
}

/**
 * Setup code the frontmatter evaluates, printed as a declaration's initialiser: a sequence is
 * parenthesised, where a comma would start another declarator.
 */
function initialiser(code: Code, component: UfComponent, spelling: Spelling): string {
  const printed = rewriteCode(code, component, spelling.rules, "pure");
  return needsParentheses(printed, "argument") ? `(${printed})` : printed;
}

/** `value as type`, the value parenthesised where `as` would bind to part of it. */
function cast(value: string, type: string): string {
  return `${needsParentheses(value) ? `(${value})` : value} as ${type}`;
}

/**
 * `T | undefined`, `T` parenthesised unless it is plainly one type a union can take as it is
 * (oxfmt removes parentheses that turn out redundant).
 */
function unionWithUndefined(type: string): string {
  return `${/^[\w$.<>[\]\s,|&"'`-]+$/.test(type) ? type : `(${type})`} | undefined`;
}

/** An expression as codegen's parser gives it. */
type Node = ReturnType<typeof parseExpression>;

/**
 * The type `ref` and `computed` infer for a value whose own type is a fresh literal type, which a
 * `const` keeps (`0`, `"idle"`, `true`) and they widen to its primitive (`number`, `string`,
 * `boolean`, `bigint`). With `branches`, a conditional whose every branch is one counts too
 * (`flag ? 1 : null` is `number | null` in a `ref`), as `ref` widens it; a `computed` keeps such a
 * union, so a getter's value counts only as one literal. A sequence's value is its last
 * expression's. Undefined for any other code, whose type the output keeps as TypeScript infers it.
 */
function widenedLiteralType(code: string, branches: boolean): string | undefined {
  const types = new Set<string>();
  const visit = (node: Node): boolean => {
    switch (node.type) {
      case "Literal":
        if (node.raw === "null") {
          if (!branches) return false;
          types.add("null");
          return true;
        }
        return primitive(node.value);
      case "UnaryExpression":
        return (
          (node.operator === "-" || node.operator === "+") &&
          node.argument.type === "Literal" &&
          (typeof node.argument.value === "number" || typeof node.argument.value === "bigint") &&
          primitive(node.argument.value)
        );
      case "TemplateLiteral":
        return node.expressions.length === 0 && primitive("");
      case "SequenceExpression":
        return visit(node.expressions.at(-1)!);
      case "ConditionalExpression":
        return branches && visit(node.consequent) && visit(node.alternate);
      default:
        return false;
    }
  };
  const primitive = (value: unknown): boolean => {
    const type = typeof value;
    if (type !== "number" && type !== "string" && type !== "boolean" && type !== "bigint") {
      return false;
    }
    types.add(type);
    return true;
  };
  return visit(parseExpression(code)) ? [...types].join(" | ") : undefined;
}
