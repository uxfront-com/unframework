import Panel from "./Panel";
import { type ComponentProps, type JSX, Show, createSignal, splitProps } from "solid-js";

export default function Board(
  props: Omit<ComponentProps<"div">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [showA, setShowA] = createSignal(true);
  const [showB, setShowB] = createSignal(true);
  const [entries, setEntries] = createSignal<string[]>([]);

  function record(entry: string) {
    setEntries([...entries(), entry]);
  }

  return (
    <div class={props.class ? `board ${props.class}` : "board"} {...others}>
      <Show when={showA()}>
        <Panel name="a" onClosed={record} />
      </Show>
      <Show when={showB()}>
        <Panel name="b" onClosed={record} />
      </Show>
      <button type="button" onClick={() => setShowA(false)}>
        Hide a
      </button>
      <button type="button" onClick={() => setShowB(false)}>
        Hide b
      </button>
      <output>{entries().join(", ")}</output>
    </div>
  );
}
