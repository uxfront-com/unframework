import type { JSX } from "solid-js";
import "virtual:styleframe.css";

export default function Note(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <p
      class={
        props.class
          ? `_padding:md _background-color:surface _color:text ${props.class}`
          : "_padding:md _background-color:surface _color:text"
      }
      style={props.style}
      {...scopeAttributes(props)}
    >
      {props.text}
    </p>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
