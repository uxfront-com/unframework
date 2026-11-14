import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface Entry {
  id: number;
  html: string;
}

export interface ChangelogProps {
  entries: Entry[];
}

export default component$<ChangelogProps & { class?: ClassList; style?: CSSProperties }>(
  ({ entries, class: className, style, ...attributes }) => {
    return (
      <ul class={["changelog", className]} {...scopeAttributes(attributes)} style={style}>
        {entries.map((entry) => (
          <li key={entry.id} dangerouslySetInnerHTML={entry.html || undefined} />
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
