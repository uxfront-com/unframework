// The preview's prop controls (ADR-0088, A4 of the M7 plan): a prop gets one when its type is
// `boolean`, `string`, `number` or a union of string literals, read from the component's API as
// the resolver reports it (`ApiMember.type` and its resolved `literals`). Any other type is named
// as not controllable, with the type as written, so the shell says why.
import type { ApiMember } from "@unframework.dev/ir";

/** A prop the shell can set, and the value it starts with. */
export type PropControl =
  | { name: string; optional: boolean; kind: "boolean"; initial: boolean }
  | { name: string; optional: boolean; kind: "string"; initial: string }
  | { name: string; optional: boolean; kind: "number"; initial: number }
  | { name: string; optional: boolean; kind: "select"; options: string[]; initial: string };

/** A prop the shell cannot set: its name, its type as written, and why. */
export interface UncontrolledProp {
  name: string;
  type: string;
  reason: string;
}

/** What the shell shows for a component's props. */
export interface PropControls {
  controls: PropControl[];
  uncontrolled: UncontrolledProp[];
}

/**
 * The controls of a component's props, in member order. An optional prop starts unset, so the
 * component's own default applies until the control changes; `initial` is the value the control
 * shows then. A required prop starts at `initial`, which every target is given.
 */
export function propControls(props: readonly ApiMember[]): PropControls {
  const controls: PropControl[] = [];
  const uncontrolled: UncontrolledProp[] = [];
  for (const member of props) {
    const control = controlOf(member);
    if (typeof control === "string") {
      uncontrolled.push({ name: member.name, type: member.type, reason: control });
    } else {
      controls.push(control);
    }
  }
  return { controls, uncontrolled };
}

/** A member's control, or why it has none. */
export function controlOf(member: ApiMember): PropControl | string {
  const { name, optional } = member;
  // The literals an alias resolves to come first: the text as written (`Tone`) names none.
  const members = member.literals?.length ? member.literals : unionMembers(member.type);
  if (!members) return `its type, ${member.type}, is not one the preview can set`;
  // `undefined` in a union only says the prop may be left out, which an optional control does.
  const values = members.filter((each) => each !== "undefined");
  const allowsUndefined = values.length < members.length;
  if (values.length === 1) {
    const [only] = values;
    if (only === "boolean")
      return { name, optional: optional || allowsUndefined, kind: "boolean", initial: false };
    if (only === "string")
      return { name, optional: optional || allowsUndefined, kind: "string", initial: "" };
    if (only === "number")
      return { name, optional: optional || allowsUndefined, kind: "number", initial: 0 };
  }
  if (values.length === 2 && values.includes("true") && values.includes("false")) {
    return { name, optional: optional || allowsUndefined, kind: "boolean", initial: false };
  }
  const strings = values.map(stringLiteral).filter((each) => each !== undefined);
  if (strings.length && strings.length === values.length) {
    const options = [...new Set(strings)];
    return {
      name,
      optional: optional || allowsUndefined,
      kind: "select",
      options,
      initial: options[0]!,
    };
  }
  return `its type, ${member.type}, is not boolean, string, number or a union of string literals`;
}

/**
 * The members of a union type as written, split at its top-level `|`, or `undefined` when the
 * text holds brackets, generics or a template literal the split could misread.
 */
export function unionMembers(type: string): string[] | undefined {
  const text = type.trim().replace(/^\|/, "");
  const members: string[] = [];
  let current = "";
  let quote: string | undefined;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quote) {
      current += char;
      if (char === "\\") {
        current += text[(index += 1)] ?? "";
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if ("()[]{}<>`".includes(char)) return undefined;
    if (char === "|") {
      members.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (quote) return undefined;
  members.push(current.trim());
  return members.every(Boolean) ? members : undefined;
}

/** A string literal's value, as TypeScript writes it (`"primary"`, `'primary'`), or `undefined`. */
export function stringLiteral(text: string): string | undefined {
  if (text.length < 2) return undefined;
  const quote = text[0];
  if ((quote !== '"' && quote !== "'") || text.at(-1) !== quote) return undefined;
  const body = text.slice(1, -1);
  try {
    // A single-quoted literal reads as JSON once its quotes are double and its own `"` escaped.
    const json = quote === '"' ? text : `"${body.replace(/\\'/g, "'").replace(/"/g, '\\"')}"`;
    const value: unknown = JSON.parse(json);
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}
