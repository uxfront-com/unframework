import { KeyedFor } from "./_unframework/KeyedFor";
import { Teleport } from "./_unframework/Teleport";
import { type ComponentProps, type JSX, Show, createSignal, splitProps } from "solid-js";

interface Row {
  id: number;
  label: string;
}

export default function Panel(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

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
