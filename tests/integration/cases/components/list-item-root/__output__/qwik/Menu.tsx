import Item from "./Item";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ entries: string[] } & { class?: ClassList; style?: CSSProperties }>(
  ({ entries, class: className, style }) => {
    return (
      <ul aria-label="Menu" class={className} style={style}>
        {entries.map((entry) => (
          <Item key={entry} label={entry} />
        ))}
      </ul>
    );
  },
);
