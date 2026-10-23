import type { JSX } from "solid-js";
import "virtual:styleframe.css";

export default function Tag(
  props: { label: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <span
      class={
        props.class
          ? `_padding:lg _background-color:primary _color:on-primary _border-radius:[4px] ${props.class}`
          : "_padding:lg _background-color:primary _color:on-primary _border-radius:[4px]"
      }
      style={props.style}
      {...scopeAttributes(props)}
    >
      {props.label}
    </span>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
