import Legend from "./Legend";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ series: string[] } & { class?: ClassList; style?: CSSProperties }>(
  ({ series, class: className, style, ...attributes }) => {
    return (
      <div {...scopeAttributes(attributes)} class={className} style={style}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
