import { cx } from "./_unframework/cx";
import type { ComponentProps, JSX } from "@solidjs/web";
import { merge, omit } from "solid-js";

export interface ActionButtonProps {
  label: string;
  size: "small" | "medium" | "large";
  primary: boolean;
  busy?: boolean;
  badge: number;
}

export default function ActionButton(
  rawProps: ActionButtonProps &
    Omit<
      ComponentProps<"button">,
      "label" | "size" | "primary" | "busy" | "badge" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const props = merge(rawProps, {
    get busy() {
      return rawProps.busy === undefined ? false : rawProps.busy;
    },
  });
  const others = omit(props, "label", "size", "primary", "busy", "badge", "class");

  return (
    <button
      type="button"
      class={cx(
        "button",
        `button-${props.size}`,
        {
          "button-primary": props.primary,
          "is-busy": props.busy,
          "button-waiting": props.busy,
          "has-badge": props.badge,
        },
        props.primary ? "solid" : "outline",
        props.class,
      )}
      {...others}
    >
      {props.label}
    </button>
  );
}
