import Amber from "./Amber";
import Blue from "./Blue";
import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { For, createMemo, untrack } from "solid-js";

const items = [
  { label: "Warm", warm: true },
  { label: "Cool", warm: false },
];

export default function Shelf(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  return (
    <section {...props}>
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
            <Dynamic component={item.value.warm ? Amber : Blue}>
              <p class="caption" data-uf-c97301b3-s="" data-uf-721c504a-s="">
                {item.value.label}
              </p>
            </Dynamic>
          </div>
        )}
      </KeyedFor>
    </section>
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
