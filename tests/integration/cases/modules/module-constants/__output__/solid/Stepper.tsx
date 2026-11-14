import { type Accessor, For, type JSX, createMemo, createSignal, untrack } from "solid-js";

const STEPS = [1, 5, 10] as const;
const LIMITS = Object.freeze({ min: 0, max: 20 });
const caption = (value: number): string => `${value} of ${LIMITS.max}`;
const START = LIMITS.min + 2;

export default function Stepper(props: { class?: string; style?: JSX.CSSProperties }) {
  const [value, setValue] = createSignal(START);

  function add(step: number) {
    setValue(Math.min(LIMITS.max, value() + step));
  }

  return (
    <section
      class={props.class ? `stepper ${props.class}` : "stepper"}
      aria-label="Stepper"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p role="status">{caption(value())}</p>
      <ul>
        <KeyedFor each={STEPS} by={(step) => step}>
          {(step) => (
            <li>
              <button type="button" onClick={() => add(step())}>
                Add {step()}
              </button>
            </li>
          )}
        </KeyedFor>
      </ul>
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
