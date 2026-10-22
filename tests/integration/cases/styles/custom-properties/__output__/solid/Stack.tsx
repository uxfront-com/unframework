import type { JSX } from "solid-js";
import "./Stack.uf.tsx.css";

export default function Stack(
  props: { gap: string; accent: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <ul
      class={props.class ? `stack ${props.class}` : "stack"}
      style={{ ...{ "--gap": props.gap, "--accent": props.accent }, ...props.style }}
      data-uf-e3a22111=""
      {...scopeAttributes(props)}
    >
      <li class="item" data-uf-e3a22111="">
        One
      </li>
      <li class="item" data-uf-e3a22111="">
        Two
      </li>
      <li class="item" data-uf-e3a22111="">
        Three
      </li>
    </ul>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
