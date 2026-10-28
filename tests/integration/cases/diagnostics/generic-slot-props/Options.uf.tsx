// UF4004 generic-slot-props (info, Angular): a scoped slot whose props name the component's type
// parameter. Angular infers `T` from the inputs alone, so its slot directive types the fill with
// the constraint, `{ value: string }`, where every other target types it with the consumer's `T`.
import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Options<T extends { value: string }>({ options }: { options: T[] }) {
  const slots = defineSlots<{ option?(props: { option: T }): Element }>();
  return (
    <ul>
      {options.map((option) => (
        <li key={option.value}>{slots.option?.({ option })}</li>
      ))}
    </ul>
  );
}
