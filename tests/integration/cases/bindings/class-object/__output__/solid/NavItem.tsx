import { mergeProps } from "solid-js";

export interface NavItemProps {
  label: string;
  href: string;
  active: boolean;
  muted: boolean;
  danger?: boolean;
}

export default function NavItem(rawProps: NavItemProps) {
  const props = mergeProps({ danger: false } satisfies Partial<NavItemProps>, rawProps);
  return (
    <a
      href={props.href}
      classList={{
        active: props.active,
        "nav-item-muted": props.muted,
        "nav-item-danger": props.danger,
        "text-danger": props.danger,
      }}
      aria-current={props.active ? "page" : undefined}
    >
      {props.label}
    </a>
  );
}
