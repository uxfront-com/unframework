import { For, type JSX, createMemo, createSignal, untrack } from "solid-js";

export interface DeliveryProps {
  speeds: string[];
  extras: string[];
}

export default function Delivery(
  props: DeliveryProps & { class?: string; style?: JSX.CSSProperties },
) {
  const [speed, setSpeed] = createSignal("express");
  const [chosen, setChosen] = createSignal<string[]>(["insurance"]);

  return (
    <section
      aria-label="Delivery"
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <fieldset>
        <legend>Speed</legend>
        <KeyedFor each={props.speeds} by={(value) => value}>
          {(value) => (
            <label>
              <input
                type="radio"
                name="speed"
                value={value.value}
                checked={speed() === value.value}
                onChange={() => setSpeed(value.value)}
              />{" "}
              {value.value}
            </label>
          )}
        </KeyedFor>
      </fieldset>
      <fieldset>
        <legend>Extras</legend>
        <KeyedFor each={props.extras} by={(extra) => extra}>
          {(extra) => (
            <label>
              <input
                type="checkbox"
                value={extra.value}
                checked={chosen().includes(extra.value)}
                onChange={(event) =>
                  setChosen(toggle(chosen(), extra.value, event.currentTarget.checked))
                }
              />{" "}
              {extra.value}
            </label>
          )}
        </KeyedFor>
      </fieldset>
      <output>
        Speed: {speed()}, extras: {chosen().join(", ") || "none"}
      </output>
    </section>
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

/** The values with `value` added when `checked`, and removed otherwise. */
function toggle<T>(values: readonly T[], value: T, checked: boolean): T[] {
  return checked ? [...values, value] : values.filter((each) => each !== value);
}
