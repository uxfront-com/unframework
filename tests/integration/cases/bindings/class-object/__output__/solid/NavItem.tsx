import { cx } from "./_unframework/cx";
import { type ComponentProps, type JSX, mergeProps, splitProps } from "solid-js";

export interface NavItemProps {
  label: string;
  href: string;
  active: boolean;
  muted: boolean;
  danger?: boolean;
}

export default function NavItem(
  rawProps: NavItemProps &
    Omit<ComponentProps<"a">, "label" | "href" | "active" | "muted" | "danger" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const props = mergeProps({ danger: false } satisfies Partial<NavItemProps>, rawProps);
  const [, others] = splitProps(props, ["label", "href", "active", "muted", "danger", "class"]);

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
      {...others}
    >
      {props.label}
    </a>
  );
}
