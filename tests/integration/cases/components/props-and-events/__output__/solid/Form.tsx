import Field from "./Field";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export default function Form(
  props: { city: string } & Omit<ComponentProps<"section">, "city" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["city"]);

  const [cleared, setCleared] = createSignal("nothing");

  function clear(label: string) {
    setCleared(label);
  }

  return (
    <section aria-label="Address" {...others}>
      <Field label="Street" onClear={clear} />
      <Field label={props.city} tone="warn" onClear={(label) => clear(label.toUpperCase())} />
      <output>Cleared: {cleared()}</output>
    </section>
  );
}
