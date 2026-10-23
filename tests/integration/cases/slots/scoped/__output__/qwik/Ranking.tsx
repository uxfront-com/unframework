import List from "./List";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ names: string[] } & { class?: ClassList; style?: CSSProperties }>(
  ({ names, class: className, style, ...attributes }) => {
    return (
      <div {...scopeAttributes(attributes)} class={className} style={style}>
        <List
          items={names}
          label="Podium"
          item$={({ item, index }) => (
            <span>
              {index + 1}. <b>{item}</b>
            </span>
          )}
        />
        <List items={names} label="Initials" item$={(entry) => <i>{entry.item.slice(0, 1)}</i>} />
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
