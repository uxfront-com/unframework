import Card from "./Card";
import Tip from "./Tip";
import { KeyedFor } from "./_unframework/KeyedFor";
import { Teleport } from "./_unframework/Teleport";
import { type ComponentProps, type JSX, Show, createSignal, splitProps } from "solid-js";

interface Row {
  id: number;
  label: string;
}

export default function Board(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [rows, setRows] = createSignal<Row[]>([
    { id: 1, label: "Alpha" },
    { id: 2, label: "Beta" },
    { id: 3, label: "Gamma" },
  ]);
  const [late, setLate] = createSignal(false);

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
