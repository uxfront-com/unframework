import Amber from "./Amber";
import Blue from "./Blue";
import { type Accessor, For, type JSX, createMemo, untrack } from "solid-js";
import { Dynamic } from "solid-js/web";

const items = [
  { label: "Warm", warm: true },
  { label: "Cool", warm: false },
];

export default function Shelf(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <section class={props.class} style={props.style} {...scopeAttributes(props)}>
      <Blue>
        <p class="caption" data-uf-721c504a-s="">
          In blue
        </p>
      </Blue>
      <Amber>
        <p class="caption" data-uf-c97301b3-s="">
          In amber
        </p>
      </Amber>
      <KeyedFor each={items} by={(item) => item.label}>
        {(item) => (
          <div>
            <Dynamic component={item().warm ? Amber : Blue}>
              <p class="caption" data-uf-c97301b3-s="" data-uf-721c504a-s="">
                {item().label}
              </p>
            </Dynamic>
          </div>
        )}
      </KeyedFor>
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
