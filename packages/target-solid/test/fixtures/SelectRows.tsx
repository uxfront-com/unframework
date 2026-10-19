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
 * Selects a `<select>`'s options that hold `value`, or a value of it for an array, and none
 * where none holds it: as the value changes, and as options come and go.
 */
function selectOptions(select: HTMLSelectElement, value: () => unknown): void {
  const choose = () => {
    const current = value();
    if (!Array.isArray(current)) {
      // `selectedIndex` -1 where no option holds it: unselecting each one selects the first.
      select.selectedIndex = [...select.options].findIndex((option) => option.value === current);
      return;
    }
    for (const option of select.options) option.selected = current.includes(option.value);
  };
  createEffect(choose);
  const observer = new MutationObserver(choose);
  observer.observe(select, { childList: true, subtree: true, attributeFilter: ["value"] });
  onCleanup(() => observer.disconnect());
}
