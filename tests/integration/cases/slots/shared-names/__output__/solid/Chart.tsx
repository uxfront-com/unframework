import Legend from "./Legend";
import type { JSX } from "solid-js";

export default function Chart(
  props: { series: string[] } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div class={props.class} style={props.style}>
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
