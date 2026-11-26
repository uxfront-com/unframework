import Card from "./Card";
import Tip from "./Tip";
import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import { type ComponentProps, type JSX, Portal } from "@solidjs/web";
import { Show, createSignal, flush, omit, onSettled, untrack } from "solid-js";

interface Row {
  id: number;
  label: string;
}

export default function Board(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [rows, setRows] = createState<Row[]>([
    { id: 1, label: "Alpha" },
    { id: 2, label: "Beta" },
    { id: 3, label: "Gamma" },
  ]);
  const [late, setLate] = createState(false);

  return (
    <section class={props.class ? `board ${props.class}` : "board"} aria-label="Board" {...others}>
      <button type="button" onClick={() => setRows([...rows()].reverse())}>
        Reverse tips
      </button>
      <button type="button" onClick={() => setLate(true)}>
        Show late
      </button>
      <KeyedFor each={rows()} by={(row) => row.id}>
        {(row) => <Tip label={row.value.label} />}
      </KeyedFor>
      <Show when={late()}>
        <Teleport to="body">
          <p data-teleported="true" class="tip" role="note">
            Late tip
          </p>
        </Teleport>
      </Show>
      <Card>
        <Teleport to="body">
          <div data-teleported="true" class="slotted">
            Slotted
          </div>
        </Teleport>
      </Card>
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
