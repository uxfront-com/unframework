import { cx } from "./_unframework/cx";
import { type ComponentProps, type JSX, mergeProps, splitProps } from "solid-js";

export interface ActionButtonProps {
  label: string;
  size: "small" | "medium" | "large";
  primary: boolean;
  busy?: boolean;
  badge: number;
}

export default function ActionButton(
  rawProps: ActionButtonProps &
    Omit<ComponentProps<"button">, "label" | "size" | "primary" | "busy" | "badge" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const props = mergeProps({ busy: false } satisfies Partial<ActionButtonProps>, rawProps);
  const [, others] = splitProps(props, ["label", "size", "primary", "busy", "badge", "class"]);

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
