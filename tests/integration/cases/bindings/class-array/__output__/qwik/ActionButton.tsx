import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface ActionButtonProps {
  label: string;
  size: "small" | "medium" | "large";
  primary: boolean;
  busy?: boolean;
  badge: number;
}

export default component$<ActionButtonProps & { class?: ClassList; style?: CSSProperties }>(
  ({ label, size, primary, busy = false, badge, class: className, style, ...attributes }) => {
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
        {...scopeAttributes(attributes)}
        style={style}
      >
        {label}
      </button>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
