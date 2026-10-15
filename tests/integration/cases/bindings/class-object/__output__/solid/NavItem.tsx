import { type JSX, mergeProps } from "solid-js";

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
  const props = mergeProps({ danger: false } satisfies Partial<NavItemProps>, rawProps);
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
      aria-current={props.active ? "page" : undefined}
      style={props.style}
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
