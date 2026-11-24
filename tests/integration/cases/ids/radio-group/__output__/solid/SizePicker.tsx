import {
  type ComponentProps,
  For,
  type JSX,
  createMemo,
  createSignal,
  createUniqueId,
  splitProps,
  untrack,
} from "solid-js";

export interface SizePickerProps {
  legend: string;
  sizes: string[];
}

export default function SizePicker(
  props: SizePickerProps &
    Omit<ComponentProps<"fieldset">, "legend" | "sizes" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["legend", "sizes", "class"]);

  const group = `uf-id-${createUniqueId()}`;
  const hintId = `uf-id-${createUniqueId()}`;
  const [picked, setPicked] = createSignal("");

  function choose(size: string) {
    setPicked(size);
  }

  return (
    <fieldset
      class={props.class ? `size-picker ${props.class}` : "size-picker"}
      aria-describedby={hintId}
      {...others}
    >
      <legend>{props.legend}</legend>
      <p id={hintId}>Pick one size.</p>
      <KeyedFor each={props.sizes} by={(size) => size}>
        {(size) => (
          <div class="size">
            <input
              type="radio"
              id={`${group}-${size.index}`}
              name={group}
              value={size.value}
              onChange={() => choose(size.value)}
            />
            <label for={`${group}-${size.index}`}>{size.value}</label>
          </div>
        )}
      </KeyedFor>
      <output>{picked() || "none"}</output>
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
