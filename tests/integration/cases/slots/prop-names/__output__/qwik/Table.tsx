import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface Person {
  id: string;
  name: string;
}

export interface TableSlots {
  row$?: QRL<(props: { name: string; "data-id": string; index: number }) => JSXOutput>;
}

export default component$<
  { people: Person[] } & TableSlots & { class?: ClassList; style?: CSSProperties }
>(({ people, row$, class: className, style }) => {
  return (
    <ol aria-label="People" class={className} style={style}>
      {people.map((person, index) => (
        <li key={person.id}>{row$?.({ name: person.name, "data-id": person.id, index })}</li>
      ))}
    </ol>
  );
});
