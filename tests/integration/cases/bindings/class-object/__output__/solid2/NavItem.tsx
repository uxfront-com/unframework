import { cx } from "./_unframework/cx";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { merge, omit } from "solid-js";

export interface NavItemProps {
  label: string;
  href: string;
  active: boolean;
  muted: boolean;
  danger?: boolean;
}

export default function NavItem(
  rawProps: NavItemProps &
    Omit<
      ComponentProps<"a">,
      "label" | "href" | "active" | "muted" | "danger" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const props = merge(rawProps, {
    get danger() {
      return rawProps.danger === undefined ? false : rawProps.danger;
    },
  });
  const others = omit(props, "label", "href", "active", "muted", "danger", "class");

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
      {...others}
    >
      {props.label}
    </a>
  );
}
