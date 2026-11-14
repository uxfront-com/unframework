import {
  For,
  type JSX,
  Show,
  createMemo,
  createRoot,
  createSignal,
  getOwner,
  onCleanup,
  onMount,
  untrack,
} from "solid-js";
import { insert } from "solid-js/web";

interface Row {
  id: number;
  label: string;
}

export default function Panel(props: { class?: string; style?: JSX.CSSProperties }) {
  const [note, setNote] = createSignal(false);
  const [extras, setExtras] = createSignal<string[]>([]);
  const [rows, setRows] = createSignal<Row[]>([
    { id: 1, label: "Alpha" },
    { id: 2, label: "Beta" },
  ]);

  function addExtra() {
    setExtras([...extras(), `Extra ${extras().length + 1}`]);
  }

  return (
    <section
      class={props.class ? `panel ${props.class}` : "panel"}
      aria-label="Panel"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <button type="button" onClick={() => setNote(true)}>
        Show note
      </button>
      <button type="button" onClick={addExtra}>
        Add extra
      </button>
      <button type="button" onClick={() => setRows([...rows()].reverse())}>
        Reverse rows
      </button>
      <Show when={note()}>
        <p class="note">Note</p>
      </Show>
      <KeyedFor each={extras()} by={(extra) => extra}>
        {(extra) => <span>{extra.value}</span>}
      </KeyedFor>
      <Teleport to="body">
        <div data-teleported="true" class="first">
          First
        </div>
      </Teleport>
      <Teleport to="body">
        <div data-teleported="true" class="second">
          Second
        </div>
      </Teleport>
      <ul>
        <KeyedFor each={rows()} by={(row) => row.id}>
          {(row) => (
            <li>
              {row.value.label}
              <Teleport to="body">
                <p data-teleported="true" class="tip">
                  {row.value.label} tip
                </p>
              </Teleport>
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

/** Mounts `children` into the element `to` selects once the component has mounted, and removes them with it. */
function Teleport(props: { to: string; children: JSX.Element }): JSX.Element {
  const owner = getOwner();
  onMount(() => {
    const target = document.querySelector(props.to);
    if (!target) return;
    const [removed, remove] = createSignal(false);
    createRoot(
      (dispose) => insert(target, () => (removed() ? dispose() : props.children), null),
      owner,
    );
    onCleanup(() => remove(true));
  });
  return null;
}
