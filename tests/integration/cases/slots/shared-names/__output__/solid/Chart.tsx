import Legend from "./Legend";
import type { JSX } from "solid-js";

export default function Chart(
  props: { series: string[] } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div class={props.class} style={props.style} {...scopeAttributes(props)}>
      <Legend
        items={props.series}
        label="Series"
        swatch={({ item }) => <b>{item.slice(0, 1)}</b>}
        caption={({ item }) => <i>{item}</i>}
      />
      <Legend
        items={props.series}
        label="Captions"
        caption={({ item }) => <span>{item.toUpperCase()}</span>}
      />
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
