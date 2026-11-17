import type { JSX } from "@solidjs/web";
import { merge } from "solid-js";

export interface NavItemProps {
  label: string;
  href: string;
  active: boolean;
  muted: boolean;
  danger?: boolean;
}

export default function NavItem(
  rawProps: NavItemProps & { class?: string; style?: JSX.CSSProperties },
) {
  const props = merge(rawProps, {
    get danger() {
      return rawProps.danger === undefined ? false : rawProps.danger;
    },
  });
  return (
    <a
      href={props.href}
      class={cx(
        {
          active: props.active,
          "nav-item-muted": props.muted,
          "nav-item-danger": props.danger,
          "text-danger": props.danger,
        },
        props.class,
      )}
      aria-current={enumeratedValue(props.active ? "page" : undefined)}
      style={props.style}
      {...scopeAttributes(props)}
    >
      {props.label}
    </a>
  );
}

/** Joins class names: strings as they are, and the names of an object's truthy entries. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") names.push(part);
    else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
