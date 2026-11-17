import Lead from "./Lead";
import Member from "./Member";
import { For, type JSX, createMemo, onCleanup, untrack } from "solid-js";

export default function Team(
  props: { ids: string[] } & { class?: string; style?: JSX.CSSProperties },
) {
  let first: { reset(): void } | null = null;

  return (
    <section
      class={props.class ? `team ${props.class}` : "team"}
      aria-label="Team"
      style={props.style}
      {...scopeAttributes(props)}
    >
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
      <Lead id="hopper" class="lead" />
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
