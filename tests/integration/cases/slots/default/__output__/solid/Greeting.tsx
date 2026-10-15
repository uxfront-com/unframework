import Panel from "./Panel";
import type { JSX } from "solid-js";

export default function Greeting(
  props: { name: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <Panel title="Welcome" class={props.class} style={props.style}>
      <p>
        Hello, <strong>{props.name}</strong>!
      </p>
      <p>Your children render in the panel.</p>
    </Panel>
  );
}
