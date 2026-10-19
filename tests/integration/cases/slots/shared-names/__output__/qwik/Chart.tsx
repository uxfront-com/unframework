import Legend from "./Legend";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ series: string[] } & { class?: ClassList; style?: CSSProperties }>(
  ({ series, class: className, style }) => {
    return (
      <div class={className} style={style}>
        <Legend
          items={series}
          label="Series"
          swatch$={({ item }) => <b>{item.slice(0, 1)}</b>}
          caption$={({ item }) => <i>{item}</i>}
        />
        <Legend
          items={series}
          label="Captions"
          caption$={({ item }) => <span>{item.toUpperCase()}</span>}
        />
      </div>
    );
  },
);
