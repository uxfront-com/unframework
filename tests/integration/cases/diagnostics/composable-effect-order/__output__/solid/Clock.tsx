import { useClock } from "./useClock";
import { type JSX, createSignal, onMount } from "solid-js";

export default function Clock(props: { class?: string; style?: JSX.CSSProperties }) {
  const [ready, setReady] = createSignal(false);

  onMount(() => {
    setReady(true);
  });

  const { started } = useClock();

  return (
    <p
      class={props.class ? `clock ${props.class}` : "clock"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      {ready() ? "Ready" : "Waiting"}, {started() ? "started" : "stopped"}
    </p>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
