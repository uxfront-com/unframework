import Lead from "./Lead";
import Member from "./Member";
import {
  type ComponentProps,
  For,
  type JSX,
  createMemo,
  onCleanup,
  splitProps,
  untrack,
} from "solid-js";

export default function Team(
  props: { ids: string[] } & Omit<ComponentProps<"section">, "ids" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["ids", "class"]);

  let first: { reset(): void } | null = null;

  return (
    <section class={props.class ? `team ${props.class}` : "team"} aria-label="Team" {...others}>
      <h2>Team</h2>
      <button type="button" onClick={() => first?.reset()}>
        Reset
      </button>
      <Member
        ref={(api) => {
          first = api;
          onCleanup(() => {
            first = null;
          });
        }}
        id="ada"
      />
      <ul>
        <KeyedFor each={props.ids} by={(id) => id}>
          {(id) => (
            <li>
              <Member id={id.value} />
            </li>
          )}
        </KeyedFor>
      </ul>
      <Lead class="lead" id="hopper" />
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
