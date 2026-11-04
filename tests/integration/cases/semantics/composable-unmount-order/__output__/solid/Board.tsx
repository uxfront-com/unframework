import Panel from "./Panel";
import { type JSX, Show, createSignal } from "solid-js";

export default function Board(props: { class?: string; style?: JSX.CSSProperties }) {
  const [showA, setShowA] = createSignal(true);
  const [showB, setShowB] = createSignal(true);
  const [entries, setEntries] = createSignal<string[]>([]);

  function record(entry: string) {
    setEntries([...entries(), entry]);
  }

  return (
    <div
      class={props.class ? `board ${props.class}` : "board"}
      style={props.style}
      {...scopeAttributes(props)}
    >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
