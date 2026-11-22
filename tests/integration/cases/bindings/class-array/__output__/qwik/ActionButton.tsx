import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface ActionButtonProps {
  label: string;
  size: "small" | "medium" | "large";
  primary: boolean;
  busy?: boolean;
  badge: number;
}

export default component$<
  ActionButtonProps &
    Omit<PropsOf<"button">, "label" | "size" | "primary" | "busy" | "badge" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, size, primary, busy = false, badge, class: className, style, ...attributes }) => {
  return (
    <button
      type="button"
      class={[
        "button",
        `button-${size}`,
        { "button-primary": primary, "is-busy button-waiting": busy, "has-badge": badge },
        primary ? "solid" : "outline",
        className,
      ]}
      style={style}
      {...attributes}
    >
      {label}
    </button>
  );
});
