import type { JSX } from "solid-js";
import "./Panel.uf.tsx.css";

export default function Panel(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <aside
      class={props.class ? `panel ${props.class}` : "panel"}
      data-uf-48dda3f4=""
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p class="text" data-uf-48dda3f4="">
        {props.text}
      </p>
    </aside>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
