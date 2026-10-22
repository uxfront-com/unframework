import Box from "./Box";
import type { JSX } from "solid-js";

export interface FrameSlots {
  title?: JSX.Element;
  children?: JSX.Element;
}

export default function Frame(
  props: { label: string } & FrameSlots & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section
      class={props.class ? `frame ${props.class}` : "frame"}
      aria-label={props.label}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Box children={props.children} title={props.title} />
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
