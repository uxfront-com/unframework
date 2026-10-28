import { defineEmits, defineModel, defineSlots, type Element } from "unframework";

import type { Option } from "./types.ts";

export interface SelectProps<T extends Option> {
  options: T[];
  label?: string;
}

// A generic component (ADR-0068): a consumer's `options` infer `T`.
export default function Select<T extends Option>({ options, label = "Options" }: SelectProps<T>) {
  const selected = defineModel<T>("selected");
  const emit = defineEmits<{ pick: [option: T] }>();
  const slots = defineSlots<{ option?(props: { option: T; active: boolean }): Element }>();

  function pick(option: T) {
    selected.value = option;
    emit("pick", option);
  }

  return (
    <ul role="listbox" aria-label={label}>
      {options.map((option) => (
        <li
          key={option.id}
          role="option"
          aria-selected={selected.value?.id === option.id}
          onClick={() => pick(option)}
        >
          {slots.option?.({ option, active: selected.value?.id === option.id }) ?? option.label}
        </li>
      ))}
    </ul>
  );
}
