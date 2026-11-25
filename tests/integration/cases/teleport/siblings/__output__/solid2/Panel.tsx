import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import { type ComponentProps, type JSX, Portal } from "@solidjs/web";
import { Show, createSignal, flush, omit, onSettled, untrack } from "solid-js";

interface Row {
  id: number;
  label: string;
}

export default function Panel(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [note, setNote] = createState(false);
  const [extras, setExtras] = createState<string[]>([]);
  const [rows, setRows] = createState<Row[]>([
    { id: 1, label: "Alpha" },
    { id: 2, label: "Beta" },
  ]);

  function addExtra() {
    setExtras([...extras(), `Extra ${extras().length + 1}`]);
  }

  return (
    <section class={props.class ? `panel ${props.class}` : "panel"} aria-label="Panel" {...others}>
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

/** The teleports rendered and not yet mounted, in the order they rendered. */
const TeleportQueue: (() => void)[] = [];

/** Mounts `children` into the element `to` selects once the component has mounted, and removes them with it. */
function Teleport(props: { to: string; children: JSX.Element }): JSX.Element {
  const [target, setTarget] = createSignal<Element | null>(null);
  // Where it mounts is read once, as it mounts.
  const to = untrack(() => props.to);
  TeleportQueue.push(() => setTarget(document.querySelector(to)));
  onSettled(() => {
    if (TeleportQueue.length) {
      queueMicrotask(() => {
        for (const mount of TeleportQueue.splice(0)) {
          mount();
          flush();
        }
      });
    }
  });
  return (
    <Show when={target()}>{(mount) => <Portal mount={mount()}>{props.children}</Portal>}</Show>
  );
}
