import { type JSX, mergeProps } from "solid-js";

export interface ActionButtonProps {
  label: string;
  size: "small" | "medium" | "large";
  primary: boolean;
  busy?: boolean;
  badge: number;
}

export default function ActionButton(
  rawProps: ActionButtonProps & { class?: string; style?: JSX.CSSProperties },
) {
  const props = mergeProps({ busy: false } satisfies Partial<ActionButtonProps>, rawProps);
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
      style={props.style}
      {...scopeAttributes(props)}
    >
      {props.label}
    </button>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
