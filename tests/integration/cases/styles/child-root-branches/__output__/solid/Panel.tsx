import Heading from "./Heading";
import Status from "./Status";
import type { JSX } from "solid-js";
import "./Panel.uf.tsx.css";

export default function Panel(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <section
      class={props.class ? `panel ${props.class}` : "panel"}
      data-uf-34db6205=""
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Heading big={true} text="Release" data-uf-34db6205="" />
      <Heading big={false} text="Notes" data-uf-34db6205="" />
      <Status busy={false} text="Save" data-uf-34db6205="" />
      <Status busy={true} text="Save" data-uf-34db6205="" />
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
