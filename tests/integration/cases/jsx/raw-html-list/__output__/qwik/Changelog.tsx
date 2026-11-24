import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface Entry {
  id: number;
  html: string;
}

export interface ChangelogProps {
  entries: Entry[];
}

export default component$<
  ChangelogProps &
    Omit<PropsOf<"ul">, "entries" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ entries, class: className, style, ...attributes }) => {
  return (
    <ul class={["changelog", className]} style={style} {...attributes}>
      {entries.map((entry) => (
        <li key={entry.id} dangerouslySetInnerHTML={entry.html || undefined} />
      ))}
    </ul>
  );
});
