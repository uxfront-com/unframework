import type { Labelled } from "./types";
import type { TimeInterval } from "rxjs";
import type { JSX } from "solid-js";

type StatusProps = TimeInterval<string> & Labelled;

export default function Status(props: StatusProps & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <p class={props.class} style={props.style} {...scopeAttributes(props)}>
      {props.label}: {props.value} after {props.interval} ms
    </p>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
