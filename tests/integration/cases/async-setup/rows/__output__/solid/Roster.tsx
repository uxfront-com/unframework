import Member from "./Member";
import { For, type JSX, Show, createMemo, createSignal, untrack } from "solid-js";

export default function Roster(
  props: { ids: string[] } & { class?: string; style?: JSX.CSSProperties },
) {
  const [lead, setLead] = createSignal(true);
  const [guest, setGuest] = createSignal(false);

  return (
    <section
      class={props.class ? `roster ${props.class}` : "roster"}
      aria-label="Roster"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <button type="button" onClick={() => setLead(!lead())}>
        Switch lead
      </button>
      <button type="button" onClick={() => setGuest(!guest())}>
        Toggle guest
      </button>
      <ul>
        <KeyedFor each={props.ids} by={(id) => id}>
          {(id) => <Member id={id.value} />}
        </KeyedFor>
        <Show when={lead()} fallback={<Member id="linus" />}>
          <Member id="ada" />
        </Show>
        <Show when={guest()}>
          <Member id="hopper" />
        </Show>
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
