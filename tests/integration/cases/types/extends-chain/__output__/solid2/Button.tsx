import type { ButtonProps } from "./types";
import type { JSX } from "@solidjs/web";
import { merge } from "solid-js";

export default function Button(
  rawProps: ButtonProps & { class?: string; style?: JSX.CSSProperties },
) {
  const props = merge(rawProps, {
    get disabled() {
      return rawProps.disabled === undefined ? false : rawProps.disabled;
    },
  });
  return (
    <button
      id={props.id}
      type="button"
      disabled={props.disabled}
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      {props.label}
    </button>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
