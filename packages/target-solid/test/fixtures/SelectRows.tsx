import { For, type JSX, createEffect, createSignal, onCleanup } from "solid-js";

import { SelectRow } from "./SelectRow";

export default function SelectRows(
  props: { values: string[] } & { class?: string; style?: JSX.CSSProperties },
) {
  const [size, setSize] = createSignal("y");

  return (
    <select
      aria-label="Size"
      onChange={(event) => setSize(event.currentTarget.value)}
      ref={(select) => selectOptions(select, size)}
      class={props.class}
      style={props.style}
    >
      <For each={props.values}>{(value) => <SelectRow value={value} />}</For>
    </select>
  );
}

/**
 * Selects a `<select>`'s options that hold `value`, or a value of it for an array: as the value
 * changes, and as options come and go.
 */
function selectOptions(select: HTMLSelectElement, value: () => unknown): void {
  const choose = () => {
    const current = value();
    for (const option of select.options) {
      option.selected = Array.isArray(current)
        ? current.includes(option.value)
        : option.value === current;
    }
  };
  createEffect(choose);
  const observer = new MutationObserver(choose);
  observer.observe(select, { childList: true, subtree: true, attributeFilter: ["value"] });
  onCleanup(() => observer.disconnect());
}
