import {
  type Accessor,
  For,
  type JSX,
  createMemo,
  createSignal,
  createUniqueId,
  untrack,
} from "solid-js";

export interface SizePickerProps {
  legend: string;
  sizes: string[];
}

export default function SizePicker(
  props: SizePickerProps & { class?: string; style?: JSX.CSSProperties },
) {
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
      style={props.style}
      {...scopeAttributes(props)}
    >
      <legend>{props.legend}</legend>
      <p id={hintId}>Pick one size.</p>
      <KeyedFor each={props.sizes} by={(size) => size}>
        {(size, index) => (
          <div class="size">
            <input
              type="radio"
              id={`${group}-${index()}`}
              name={group}
              value={size()}
              onChange={() => choose(size())}
            />
            <label for={`${group}-${index()}`}>{size()}</label>
          </div>
        )}
      </KeyedFor>
      <output>{picked() || "none"}</output>
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
