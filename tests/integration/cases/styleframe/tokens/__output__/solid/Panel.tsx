import type { JSX } from "solid-js";
import "virtual:styleframe.css";
import "./Panel.uf.tsx.css";

export default function Panel(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section
      class={props.class ? `panel ${props.class}` : "panel"}
      data-uf-b6be1fd3=""
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p class="body" data-uf-b6be1fd3="">
        {props.text}
      </p>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
