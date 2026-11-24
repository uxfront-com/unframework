import {
  type ComponentProps,
  For,
  type JSX,
  createEffect,
  createMemo,
  onCleanup,
  splitProps,
  untrack,
} from "solid-js";

export interface SelectProps<T extends string> {
  label: string;
  options: readonly T[];
}

export interface SelectModels<T extends string> {
  value: T;
  onValueChange?: (value: T) => void;
}

export default function Select<T extends string>(
  props: SelectProps<T> &
    SelectModels<T> &
    Omit<ComponentProps<"label">, "label" | "options" | "value" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label", "options", "value", "onValueChange"]);

  const value = () => props.value;

  function setValue(next: T) {
    props.onValueChange?.(next);
  }

  return (
    <label {...others}>
      {props.label}{" "}
      <select
        onChange={(event) => setValue(event.currentTarget.value as T)}
        ref={(select) => selectOptions(select, value)}
      >
        <KeyedFor each={props.options} by={(option) => option}>
          {(option) => (
            <option value={option.value} selected={value() === option.value}>
              {option.value}
            </option>
          )}
        </KeyedFor>
      </select>
    </label>
  );
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
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
