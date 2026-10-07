// The events a mounted component emits (ADR-0050): each emit's arguments, copied as plain data
// when they arrive, in order. A trace records them, so a payload must read the same on every
// target: JSON-like data only. A framework's reactive proxy (Vue's `reactive`, Svelte's
// `$state`, Solid's store) is read through, and the copy taken at once, so a later replacement
// of the state never changes what was logged.
import { renameGeneratedIds } from "../normalize/rules/generated-ids.ts";

/** One emit: the event's source name and its arguments, as plain data. */
export interface EmittedEvent {
  name: string;
  args: unknown[];
}

/** A payload no trace can record, refused with the event's name and where in it the value was. */
export class PayloadError extends Error {
  override name = "PayloadError";
}

/**
 * Copies one emit's arguments as plain data, or throws a {@link PayloadError} saying why not.
 * Trailing `undefined` arguments are dropped first: a JavaScript listener cannot tell
 * `emit("change", value, undefined)` from `emit("change", value)`, and a watcher's `previous` is
 * `undefined` on its immediate first run (semantics contract, watch semantics). An `undefined`
 * before a given argument is still refused.
 */
export function copyPayload(event: string, args: readonly unknown[]): unknown[] {
  let length = args.length;
  while (length > 0 && args[length - 1] === undefined) length -= 1;
  return args.slice(0, length).map((arg, index) => copyValue(arg, `argument ${index + 1}`, event));
}

function copyValue(value: unknown, path: string, event: string): unknown {
  const refuse = (what: string): never => {
    throw new PayloadError(
      `The payload of "${event}" holds ${what} at ${path}: an emit's arguments are plain data (strings, finite numbers, booleans, null, arrays and plain objects), which every target's listener receives alike and a trace records.`,
    );
  };
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) refuse(String(value));
    // JSON has one zero.
    return value === 0 ? 0 : value;
  }
  if (value === undefined) {
    return refuse("undefined (leave the argument out, or pass null)");
  }
  if (typeof value === "function") return refuse("a function");
  if (typeof value !== "object") return refuse(`a ${typeof value}`);
  if (typeof Event !== "undefined" && value instanceof Event) return refuse("a DOM event");
  if (typeof Node !== "undefined" && value instanceof Node) return refuse("a DOM node");
  if (value instanceof Map) return refuse("a Map");
  if (value instanceof Set) return refuse("a Set");
  if (Array.isArray(value)) {
    return Array.from(value, (item, index) => copyValue(item, `${path}[${index}]`, event));
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    const constructor = (prototype as { constructor?: { name?: string } }).constructor?.name;
    return refuse(`an instance of ${constructor || "a class"}`);
  }
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    copy[key] = copyValue((value as Record<string, unknown>)[key], `${path}.${key}`, event);
  }
  return copy;
}

/**
 * Renames the compiler's generated ids in a payload (each `uf-id-…` in a string, as the
 * normaliser reads them in the DOM) the way the step's DOM renames them (`names`, from the
 * normaliser), so a payload that carries an id reads the same on every target. An id the DOM
 * does not hold takes the next number.
 */
export function renumberIds(value: unknown, names: Map<string, string>): unknown {
  if (typeof value === "string") return renameGeneratedIds(value, names);
  if (Array.isArray(value)) return value.map((item) => renumberIds(item, names));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, renumberIds(item, names)]),
    );
  }
  return value;
}

/**
 * Emits grouped by event name, names sorted, each name's argument lists in the order they came:
 * the relative order of different effects that one run triggers is not part of the contract
 * (Vue orders by trigger, Svelte and React by declaration), so a trace never records it.
 */
export function groupEvents(events: readonly EmittedEvent[]): Record<string, unknown[][]> {
  const groups = new Map<string, unknown[][]>();
  for (const { name, args } of events) groups.set(name, [...(groups.get(name) ?? []), args]);
  return Object.fromEntries([...groups.keys()].sort().map((name) => [name, groups.get(name)!]));
}
