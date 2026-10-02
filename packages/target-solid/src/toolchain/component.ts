import type { Component } from "solid-js";

/**
 * The component a test mounts or renders, checked: Solid would otherwise fail later with
 * "comp is not a function", far from the import that went wrong.
 */
export function asComponent(value: unknown): Component<Record<string, unknown>> {
  if (isComponent(value)) return value;
  throw new TypeError(
    `Expected a Solid component, received ${value === null ? "null" : typeof value}.`,
  );
}

function isComponent(value: unknown): value is Component<Record<string, unknown>> {
  return typeof value === "function";
}
