import type { JSX } from "@solidjs/web";
import { merge } from "solid-js";
import "virtual:styleframe.css";

export default function Themed(
  rawProps: { text: string; dark?: boolean } & { class?: string; style?: JSX.CSSProperties },
) {
  const props = merge(rawProps, {
    get dark() {
      return rawProps.dark === undefined ? false : rawProps.dark;
    },
  });
  return (
    <section
      data-theme={props.dark ? "dark" : "light"}
      class={
        props.class
          ? `_padding:md _background-color:surface _color:text ${props.class}`
          : "_padding:md _background-color:surface _color:text"
      }
      style={props.style}
      {...scopeAttributes(props)}
    >
      {props.text}
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
