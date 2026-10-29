import type { Labelled } from "./types";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";
import type { TimeInterval } from "rxjs";

type StatusProps = TimeInterval<string> & Labelled;

export default component$<StatusProps & { class?: ClassList; style?: CSSProperties }>(
  ({ value, interval, label, class: className, style, ...attributes }) => {
    return (
      <p {...scopeAttributes(attributes)} class={className} style={style}>
        {label}: {value} after {interval} ms
      </p>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
