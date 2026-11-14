import { DEFAULT_SIZE, SIZES, SIZE_ORDER, type Size } from "./tokens";
import { type Accessor, For, type JSX, createMemo, createSignal, untrack } from "solid-js";

export default function SizePicker(props: { class?: string; style?: JSX.CSSProperties }) {
  const [size, setSize] = createSignal<Size>(DEFAULT_SIZE);

  function pick(next: Size) {
    setSize(next);
  }

  return (
    <fieldset
      class={props.class ? `size-picker ${props.class}` : "size-picker"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <legend>Size</legend>
      <p role="status">Picked: {SIZES[size()]}</p>
      <ul>
        <KeyedFor each={SIZE_ORDER} by={(each) => each}>
          {(each) => (
            <li>
              <button type="button" aria-pressed={size() === each()} onClick={() => pick(each())}>
                {SIZES[each()]}
              </button>
            </li>
          )}
        </KeyedFor>
      </ul>
    </fieldset>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (item: Accessor<T>, index: Accessor<number>) => JSX.Element;
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
        return untrack(() => props.children(item, index));
      }}
    </For>
  );
}
