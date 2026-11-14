import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface Entry {
  id: string;
  label: string;
}

export interface ChecklistProps {
  entries: Entry[];
}

export default component$<ChecklistProps & { class?: ClassList; style?: CSSProperties }>(
  ({ entries, class: className, style, ...attributes }) => {
    return (
      <ul class={["checklist", className]} {...scopeAttributes(attributes)} style={style}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <label>
              {entry.label}
              <input name={`note-${entry.id}`} aria-label={`Note for ${entry.label}`} />
            </label>
          </li>
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
