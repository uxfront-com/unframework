import Swatch from "./Swatch";
import type { Tone } from "./types";
import type { JSX } from "solid-js";

export type { Tone } from "./types";

export default function Palette(
  props: { tone: Tone } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div
      class={props.class ? `palette ${props.class}` : "palette"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Swatch tone={props.tone} />
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
