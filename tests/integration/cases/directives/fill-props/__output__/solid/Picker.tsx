import {
  type ComponentProps,
  For,
  type JSX,
  createMemo,
  createSignal,
  splitProps,
  untrack,
} from "solid-js";

export interface PickerSlots {
  option?: (props: { option: { id: string; label: string } }) => JSX.Element;
}

export default function Picker(
  props: PickerSlots &
    Omit<ComponentProps<"div">, "option" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["option", "class"]);

  const [options, setOptions] = createSignal([
    { id: "x", label: "Xray" },
    { id: "y", label: "Yankee" },
  ]);

  return (
    <div class={props.class ? `picker ${props.class}` : "picker"} {...others}>
      <ul aria-label="Options">
        <KeyedFor each={options()} by={(option) => option.id}>
          {(option) => <li>{props.option?.({ option: option.value })}</li>}
        </KeyedFor>
      </ul>
      <button
        type="button"
        onClick={() =>
          setOptions(
            options().map((option) => (option.id === "x" ? { id: "x", label: "Xenon" } : option)),
          )
        }
      >
        Rename option
      </button>
    </div>
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
