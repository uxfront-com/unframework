import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface Entry {
  id: string;
  label: string;
}

export interface ChecklistProps {
  entries: Entry[];
}

export default component$<
  ChecklistProps &
    Omit<PropsOf<"ul">, "entries" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ entries, class: className, style, ...attributes }) => {
  return (
    <ul class={["checklist", className]} style={style} {...attributes}>
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
});
