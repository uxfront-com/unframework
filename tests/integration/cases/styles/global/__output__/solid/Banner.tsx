import Hint from "./Hint";
import type { JSX } from "solid-js";
import "./Banner.uf.tsx.css";

export default function Banner(
  props: { tip: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div
      class={props.class ? `banner ${props.class}` : "banner"}
      data-uf-e25060c2=""
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Hint text={props.tip} data-uf-e25060c2="" />
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
