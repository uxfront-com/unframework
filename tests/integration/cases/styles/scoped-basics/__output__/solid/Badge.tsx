import type { JSX } from "solid-js";
import "./Badge.uf.tsx.css";

export default function Badge(
  props: { label: string; count: number } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <span
      class={props.class ? `badge ${props.class}` : "badge"}
      data-uf-d9cef2e7=""
      style={props.style}
      {...scopeAttributes(props)}
    >
      <span class="label" data-uf-d9cef2e7="">
        {props.label}
      </span>
      <span class="count" data-uf-d9cef2e7="">
        {props.count}
      </span>
    </span>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
