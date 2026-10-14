import { For, type JSX, createEffect, createSignal } from "solid-js";

import { SelectRow } from "./SelectRow";

export default function SelectRows(
  props: { values: string[] } & { class?: string; style?: JSX.CSSProperties },
) {
  const [size, setSize] = createSignal("y");

  return (
    <select
      aria-label="Size"
      onChange={(event) => setSize(event.currentTarget.value)}
      ref={(select) => createEffect(() => selectOptions(select, size()))}
      class={props.class}
      style={props.style}
    >
      <For each={props.values}>{(value) => <SelectRow value={value} />}</For>
    </select>
  );
}

/** Selects a `<select>`'s options that hold `value`, or a value of it for an array. */
function selectOptions(select: HTMLSelectElement, value: unknown): void {
  for (const option of select.options) {
    option.selected = Array.isArray(value) ? value.includes(option.value) : option.value === value;
  }
}
