import Field from "./Field";
import { type JSX, createSignal } from "solid-js";

export default function Form(
  props: { city: string } & { class?: string; style?: JSX.CSSProperties },
) {
  const [cleared, setCleared] = createSignal("nothing");

  function clear(label: string) {
    setCleared(label);
  }

  return (
    <section aria-label="Address" class={props.class} style={props.style}>
      <Field label="Street" onClear={clear} />
      <Field label={props.city} tone="warn" onClear={(label) => clear(label.toUpperCase())} />
      <output>Cleared: {cleared()}</output>
    </section>
  );
}
