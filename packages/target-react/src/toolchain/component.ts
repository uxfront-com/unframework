import type { ComponentType } from "react";

type Component = ComponentType<Record<string, unknown>>;

/**
 * The component a test mounts or renders, checked: React would otherwise fail later with
 * "Element type is invalid", far from the import that went wrong.
 */
export function asComponent(value: unknown): Component {
  if (isComponent(value)) return value;
  throw new TypeError(
    `Expected a React component, received ${value === null ? "null" : typeof value}.`,
  );
}

/** A function component, or an exotic one (memo, forwardRef, lazy) that React tags. */
function isComponent(value: unknown): value is Component {
  return (
    typeof value === "function" ||
    (typeof value === "object" && value !== null && "$$typeof" in value)
  );
}
