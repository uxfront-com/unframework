import { For, type JSX, createEffect, onCleanup } from "solid-js";

export interface SelectProps<T extends string> {
  label: string;
  options: readonly T[];
}

export interface SelectModels<T extends string> {
  value: T;
  onValueChange?: (value: T) => void;
}

export default function Select<T extends string>(
  props: SelectProps<T> & SelectModels<T> & { class?: string; style?: JSX.CSSProperties },
) {
  const value = () => props.value;

  function setValue(next: T) {
    props.onValueChange?.(next);
  }

  return (
    <label class={props.class} style={props.style} {...scopeAttributes(props)}>
      {props.label}{" "}
      <select
        onChange={(event) => setValue(event.currentTarget.value as T)}
        ref={(select) => selectOptions(select, value)}
      >
        <For each={props.options}>
          {(option) => (
            <option value={option} selected={value() === option}>
              {option}
            </option>
          )}
        </For>
      </select>
    </label>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
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
      select.selectedIndex = [...select.options].findIndex(
        (option) => option.value === String(current),
      );
      return;
    }
    for (const option of select.options) option.selected = current.includes(option.value);
  };
  createEffect(choose);
  const observer = new MutationObserver(choose);
  observer.observe(select, { childList: true, subtree: true, attributeFilter: ["value"] });
  onCleanup(() => observer.disconnect());
}
