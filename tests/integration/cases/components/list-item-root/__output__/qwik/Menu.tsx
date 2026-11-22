import Item from "./Item";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { entries: string[] } & Omit<PropsOf<"ul">, "entries" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ entries, class: className, style, ...attributes }) => {
  return (
    <ul aria-label="Menu" class={className} style={style} {...attributes}>
      {entries.map((entry) => (
        <Item key={entry} label={entry} />
      ))}
    </ul>
  );
});
