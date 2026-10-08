// Where a value comes from, as in-place mutation (UF2004) and the framework's own elements
// (UF3028) judge it (ADR-0045). State is replaced whole (ADR-0008), so code may change in place
// only a value no state shares: one it has just built, and only that value itself, since a
// shallow copy shares every member with the value it copies; a deep copy (`structuredClone`)
// with all it holds; the DOM (an element, the event, a global). A name holds what every value
// written to it anywhere holds, so a setup `let` given a state's value once is a state's value.

import type { AST } from "@unframework/parser";
import { visitorKeys } from "@unframework/parser";

import type { ComponentFunction } from "./render.ts";
import type { Scopes } from "./scope.ts";

/**
 * Where one value comes from: a value code has just built (`fresh`: an object or array literal,
 * `new`, a shallow copy such as `Array.from`), a deep copy (`clone`: `structuredClone`,
 * `JSON.parse`), an element the framework renders (a template ref's, the event's
 * `currentTarget` and `target`, and the nodes reached from them), the handler's event, a global
 * (`document`, `localStorage`), or anything else (`other`: state, a prop, a list's item, a
 * constant, a parameter, a member of a shallow copy), which state's replacement rule protects.
 */
export type Origin = "fresh" | "clone" | "element" | "event" | "global" | "other";

/** Where a value may come from: the origin of each value it may hold, and what it is, for a message. */
export interface Provenance {
  readonly origins: ReadonlySet<Origin>;
  readonly what?: string;
  /** Whether it is `other` as a member of a shallow copy, which the copy shares. */
  readonly shared?: boolean;
}

export const FRESH: Provenance = { origins: new Set(["fresh"]) };
export const CLONE: Provenance = { origins: new Set(["clone"]) };
export const ELEMENT: Provenance = { origins: new Set(["element"]) };
export const EVENT: Provenance = { origins: new Set(["event"]) };
export const GLOBAL: Provenance = { origins: new Set(["global"]) };
/** No value at all: `null` and `undefined`, which nothing changes in place. */
export const NONE: Provenance = { origins: new Set() };

/** A value from elsewhere, and what it is for a message. */
export function other(what?: string): Provenance {
  return { origins: new Set(["other"]), ...(what === undefined ? {} : { what }) };
}

/** Whether code may change the value in place: every value it may hold comes from it. */
export function mutable(provenance: Provenance): boolean {
  return provenance.origins.size > 0 && !provenance.origins.has("other");
}

/**
 * What a name holds that may hold any of several values: each one's origins, or what a message
 * says of the name (`name`) where one of them comes from elsewhere.
 */
export function joined(all: readonly Provenance[], name: string): Provenance {
  const origins = new Set<Origin>();
  for (const item of all) for (const origin of item.origins) origins.add(origin);
  if (!origins.has("other")) return { origins };
  return all.some((item) => item.shared)
    ? {
        ...other(
          `\`${name}\`, which holds a member of a value the code built, which may be state's own,`,
        ),
        shared: true,
      }
    : other(`\`${name}\`, which holds a value from elsewhere,`);
}

/**
 * What a value holds that may be any of several values (`a ?? b`, `c ? a : b`): each one's
 * origins, and the first message of one from elsewhere.
 */
export function either(...all: readonly Provenance[]): Provenance {
  const origins = new Set<Origin>();
  for (const item of all) for (const origin of item.origins) origins.add(origin);
  const from = all.find((item) => item.origins.has("other"));
  return from ? { ...from, origins } : { origins };
}

/** A member of a shallow copy, which the copy shares with the value it copies. */
export function shared(text: string): Provenance {
  return {
    ...other(
      `\`${text.length > 40 ? `${text.slice(0, 40)}…` : text}\`, a member of a value the code built, which may be state's own,`,
    ),
    shared: true,
  };
}

/** The event's members that are elements the framework renders: the listener's and the target. */
const EVENT_ELEMENTS: ReadonlySet<string> = new Set(["currentTarget", "relatedTarget", "target"]);

/**
 * Where a member read of a value comes from (`copy[0]`, `holder.list`, `el.parentElement`): a
 * value code built holds what it was built with and what code writes into it (`members`, judged
 * where the value is written: `{ ...x, tags: [] }`'s `tags` is fresh, a member a spread copied
 * is shared with what it copies); a deep copy's, the DOM's and a global's are their own.
 */
export function memberProvenance(
  object: Provenance,
  property: string | undefined,
  text: string,
  members?: () => Provenance,
): Provenance {
  if (object.origins.has("other")) return object;
  if (object.origins.has("fresh")) return heldMembers(object, text, members);
  const origins = new Set<Origin>();
  for (const origin of object.origins) {
    origins.add(
      origin === "event" && property !== undefined && EVENT_ELEMENTS.has(property)
        ? "element"
        : origin,
    );
  }
  return { origins };
}

/** The methods that return the value they are called on, changed. */
const RETURNS_RECEIVER: ReadonlySet<string> = new Set([
  "add",
  "copyWithin",
  "fill",
  "reverse",
  "set",
  "sort",
]);

/** The array methods that return a new array: a shallow copy, or the callback's results. */
const NEW_ARRAY: ReadonlySet<string> = new Set([
  "concat",
  "filter",
  "flat",
  "flatMap",
  "map",
  "slice",
  "splice",
  "toReversed",
  "toSorted",
  "toSpliced",
  "with",
]);

/**
 * Where a method's result comes from, by its receiver's: a method that returns a new array gives
 * a fresh one whatever its receiver (`todos.value.filter(…)`, whose items are still the
 * receiver's); the DOM's methods give the DOM (`el.querySelector(…)`); on a value code built, a
 * method that returns its receiver gives it, and anything else (`find`, `at`, `pop`, a `Map`'s
 * `get`) gives a member (`members`, see {@link memberProvenance}), which a deep copy owns.
 */
export function callProvenance(
  receiver: Provenance,
  method: string | undefined,
  text: string,
  members?: () => Provenance,
): Provenance {
  if (method !== undefined && NEW_ARRAY.has(method)) return FRESH;
  if (receiver.origins.has("other")) return receiver;
  const origins = new Set<Origin>();
  for (const origin of receiver.origins) {
    if (origin === "fresh" || origin === "clone") {
      if (method !== undefined && RETURNS_RECEIVER.has(method)) origins.add(origin);
      else if (origin === "clone") origins.add("clone");
      else return heldMembers(receiver, text, members);
    } else {
      origins.add(origin);
    }
  }
  return { origins };
}

/**
 * What a value code built holds, where `members` tells it: a member from elsewhere is one the
 * value shares with what it was copied from, as a message says it.
 */
function heldMembers(
  object: Provenance,
  text: string,
  members: (() => Provenance) | undefined,
): Provenance {
  const held = members?.();
  if (!held || held.origins.has("other")) return shared(text);
  const origins = new Set(held.origins);
  for (const origin of object.origins) if (origin !== "fresh") origins.add(origin);
  return { origins };
}

/** Whether a method returns a new array whose items are its receiver's (not `map`'s results). */
export function copiesItems(method: string): boolean {
  return NEW_ARRAY.has(method) && method !== "map" && method !== "flatMap";
}

/** Whether a method returns the value it is called on. */
export function returnsReceiver(method: string): boolean {
  return RETURNS_RECEIVER.has(method);
}

/** The assignments that keep what the target holds or write the value: `??=`, `||=`, `&&=`. */
export const LOGICAL_ASSIGNMENTS: ReadonlySet<string> = new Set(["??=", "||=", "&&="]);

/** The methods that put a value into their receiver, and which of their arguments they put. */
const INSERTING: ReadonlyMap<string, number> = new Map([
  ["add", 0],
  ["fill", 0],
  ["push", 0],
  ["set", 1],
  ["splice", 2],
  ["unshift", 0],
]);

/**
 * The values code writes into what each name a component declares holds, a variable's or a
 * parameter's: `name.key = value`, `name[key] = value`, `name[key] ??= value` (and `||=`, `&&=`,
 * which keep the member or write the value) and the methods that insert one (`push`, `set`,
 * `add`, …), each with its key where it is static, `null` where the value is not known (an
 * arithmetic compound assignment, a spread argument). See {@link AssignedValues} for the names.
 */
export type MemberValues = ReadonlyMap<
  object,
  readonly { key: string | undefined; value: AST.Expression | null }[]
>;

const MEMBERS = new WeakMap<ComponentFunction, MemberValues>();

/** The values code writes into each name's value (see {@link MemberValues}), read once. */
export function memberValues(component: ComponentFunction, scopes: Scopes): MemberValues {
  const known = MEMBERS.get(component);
  if (known) return known;
  const values = new Map<object, { key: string | undefined; value: AST.Expression | null }[]>();
  const add = (holder: AST.Node, key: string | undefined, value: AST.Expression | null) => {
    if (holder.type !== "Identifier") return;
    const resolution = scopes.resolve(holder as AST.IdentifierReference);
    if (resolution.kind !== "variable" && resolution.kind !== "parameter") return;
    const list = values.get(resolution.declaration) ?? [];
    list.push({ key, value });
    values.set(resolution.declaration, list);
  };
  visit(component.body, (node) => {
    if (node.type === "AssignmentExpression" && node.left.type === "MemberExpression") {
      const { left } = node;
      const written = node.operator === "=" || LOGICAL_ASSIGNMENTS.has(node.operator);
      add(left.object, staticKey(left), written ? node.right : null);
    } else if (
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      !node.callee.computed &&
      node.callee.property.type === "Identifier"
    ) {
      const from = INSERTING.get(node.callee.property.name);
      if (from === undefined) return;
      for (const argument of node.arguments.slice(from)) {
        add(node.callee.object, undefined, argument.type === "SpreadElement" ? null : argument);
      }
    }
  });
  MEMBERS.set(component, values);
  return values;
}

/**
 * The iterable each loop variable a component declares walks (`for (const li of items)`), by
 * the identifier that declares it: it holds the iterable's items.
 */
const LOOPS = new WeakMap<ComponentFunction, ReadonlyMap<object, AST.Expression>>();

/** The iterable of each `for…of` loop's variable (see {@link LOOPS}), read once. */
export function loopSources(component: ComponentFunction): ReadonlyMap<object, AST.Expression> {
  const known = LOOPS.get(component);
  if (known) return known;
  const sources = new Map<object, AST.Expression>();
  visit(component.body, (node) => {
    if (node.type !== "ForOfStatement" || node.left.type !== "VariableDeclaration") return;
    for (const declarator of node.left.declarations) {
      if (declarator.id.type === "Identifier") sources.set(declarator.id, node.right);
    }
  });
  LOOPS.set(component, sources);
  return sources;
}

/** A member's static key: `a.b`, `a["b"]`, `a[0]`. */
function staticKey(node: AST.MemberExpression): string | undefined {
  const { property } = node;
  if (!node.computed) return property.type === "Identifier" ? property.name : undefined;
  return property.type === "Literal" &&
    (typeof property.value === "string" || typeof property.value === "number")
    ? String(property.value)
    : undefined;
}

/** The built-in functions that return a new array or object: a shallow copy of their argument's members. */
const SHALLOW_COPIES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["Array", new Set(["from", "of"])],
  ["Object", new Set(["entries", "fromEntries", "groupBy", "keys", "values"])],
]);

/**
 * Where the result of a global's method comes from (`Object.values(…)`, `document.querySelector(…)`):
 * a shallow copy for the built-ins that build one, a deep copy for `JSON.parse`, the DOM for a
 * host object's (a lower-case global: `document`, `window`); anything else a constructor or a
 * namespace returns (`Object.freeze(x)`, `Reflect.get(…)`) may be its argument or a member of it.
 * `undefined` for `Object.assign`, whose result is its first argument.
 */
export function globalCallProvenance(global: string, method: string): Provenance | undefined {
  if (global === "JSON" && method === "parse") return CLONE;
  if (SHALLOW_COPIES.get(global)?.has(method)) return FRESH;
  if (global === "Object" && method === "assign") return undefined;
  if (/^[a-z]/.test(global)) return GLOBAL;
  return other(`a value \`${global}.${method}\` returns,`);
}

/**
 * The values each name a component declares is given: its initial value, then every value
 * written to it anywhere in the component, `null` where the value is not known (a compound
 * assignment, a destructuring pattern, a loop's variable). A name declared without a value
 * starts with none. Names a declarator does not declare (a parameter, a function, a `catch`
 * clause's) have no entry.
 */
export type AssignedValues = ReadonlyMap<object, readonly (AST.Expression | null)[]>;

const ASSIGNED = new WeakMap<ComponentFunction, AssignedValues>();

/** The values each name of a component is given (see {@link AssignedValues}), read once. */
export function assignedValues(component: ComponentFunction, scopes: Scopes): AssignedValues {
  const known = ASSIGNED.get(component);
  if (known) return known;
  const values = new Map<object, (AST.Expression | null)[]>();
  const later = new Map<object, (AST.Expression | null)[]>();
  const loopDeclarations = new WeakSet<object>();
  const assign = (target: AST.Node, value: AST.Expression | null): void => {
    if (target.type !== "Identifier") {
      for (const name of assignedNames(target)) assign(name, null);
      return;
    }
    const resolution = scopes.resolve(target as AST.IdentifierReference);
    if (resolution.kind !== "variable") return;
    const list = later.get(resolution.declaration) ?? [];
    list.push(value);
    later.set(resolution.declaration, list);
  };
  visit(component.body, (node) => {
    switch (node.type) {
      case "VariableDeclarator":
        if (node.id.type === "Identifier") {
          values.set(node.id, loopDeclarations.has(node) ? [null] : node.init ? [node.init] : []);
        } else {
          for (const name of assignedNames(node.id)) values.set(name, [null]);
        }
        break;
      case "AssignmentExpression":
        assign(node.left, node.operator === "=" ? node.right : null);
        break;
      case "ForOfStatement":
      case "ForInStatement":
        if (node.left.type === "VariableDeclaration") {
          for (const declarator of node.left.declarations) loopDeclarations.add(declarator);
        } else {
          assign(node.left, null);
        }
        break;
      default:
        break;
    }
  });
  for (const [declaration, list] of later) {
    const own = values.get(declaration);
    if (own) own.push(...list);
  }
  ASSIGNED.set(component, values);
  return values;
}

/** The identifiers a pattern assigns or declares, through defaults, rests and nesting. */
function assignedNames(pattern: AST.Node): AST.Node[] {
  switch (pattern.type) {
    case "Identifier":
      return [pattern];
    case "AssignmentPattern":
      return assignedNames(pattern.left);
    case "RestElement":
      return assignedNames(pattern.argument);
    case "ArrayPattern":
      return pattern.elements.flatMap((element) => (element ? assignedNames(element) : []));
    case "ObjectPattern":
      return pattern.properties.flatMap((property) =>
        assignedNames(property.type === "RestElement" ? property : property.value),
      );
    default:
      return [];
  }
}

/** Visits every node in a tree, depth first. */
function visit(node: unknown, enter: (node: AST.Node) => void): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) visit(item, enter);
    return;
  }
  const typed = node as AST.Node;
  if (typeof typed.type !== "string") return;
  enter(typed);
  for (const key of visitorKeys[typed.type] ?? []) {
    visit((typed as unknown as Record<string, unknown>)[key], enter);
  }
}
