import Panel from "./Panel";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

export default function Board(
  props: Omit<ComponentProps<"div">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [showA, setShowA] = createState(true);
  const [showB, setShowB] = createState(true);
  const [entries, setEntries] = createState<string[]>([]);

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
