import { defineSlots } from "unframework";
import type { Element } from "unframework";

export interface Person {
  id: string;
  name: string;
}

export default function Table({ people }: { people: Person[] }) {
  const slots = defineSlots<{
    row?(props: { name: string; "data-id": string; index: number }): Element;
  }>();
  return (
    <ol aria-label="People">
      {people.map((person, index) => (
        <li key={person.id}>{slots.row?.({ name: person.name, "data-id": person.id, index })}</li>
      ))}
    </ol>
  );
}
