import { DEFAULT_SIZE, SIZES, SIZE_ORDER, type Size } from "./tokens";
import {
  type ComponentProps,
  For,
  type JSX,
  createMemo,
  createSignal,
  splitProps,
  untrack,
} from "solid-js";

export default function SizePicker(
  props: Omit<ComponentProps<"fieldset">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [size, setSize] = createSignal<Size>(DEFAULT_SIZE);

  function pick(next: Size) {
    setSize(next);
  }

  return (
    <fieldset class={props.class ? `size-picker ${props.class}` : "size-picker"} {...others}>
      <legend>Size</legend>
      <p role="status">Picked: {SIZES[size()]}</p>
      <ul>
        <KeyedFor each={SIZE_ORDER} by={(each) => each}>
          {(each) => (
            <li>
              <button
                type="button"
                aria-pressed={size() === each.value}
                onClick={() => pick(each.value)}
              >
                {SIZES[each.value]}
              </button>
            </li>
          )}
        </KeyedFor>
      </ul>
    </fieldset>
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
