import List from "./List";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ names: string[] } & { class?: ClassList; style?: CSSProperties }>(
  ({ names, class: className, style }) => {
    return (
      <div class={className} style={style}>
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
