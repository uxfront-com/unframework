import Item from "./Item";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ entries: string[] } & { class?: ClassList; style?: CSSProperties }>(
  ({ entries, class: className, style, ...attributes }) => {
    return (
      <ul aria-label="Menu" {...scopeAttributes(attributes)} class={className} style={style}>
        {entries.map((entry) => (
          <Item key={entry} label={entry} />
        ))}
      </ul>
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
