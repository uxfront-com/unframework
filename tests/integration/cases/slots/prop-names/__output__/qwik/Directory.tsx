import Table from "./Table";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface Person {
  id: string;
  name: string;
}

export default component$<{ people: Person[] } & { class?: ClassList; style?: CSSProperties }>(
  ({ people, class: className, style }) => {
    return (
      <>
        <Table
          people={people}
          row$={({ name, "data-id": id, index }) => (
            <span>
              {index + 1}: {name} ({id})
            </span>
          )}
          class={className}
          style={style}
        />
      </>
    );
  },
);
