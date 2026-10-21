import type { JSX } from "solid-js";
import "./Progress.uf.tsx.css";

export default function Progress(
  props: { label: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div
      class={props.class ? `progress ${props.class}` : "progress"}
      data-uf-0738d8af=""
      style={props.style}
      {...scopeAttributes(props)}
    >
      <span class="dot" data-uf-0738d8af="" />
      <span data-uf-0738d8af="">{props.label}</span>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
