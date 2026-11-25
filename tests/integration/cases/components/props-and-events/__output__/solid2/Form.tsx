import Field from "./Field";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Form(
  props: { city: string } & Omit<ComponentProps<"section">, "city" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "city");

  const [cleared, setCleared] = createState("nothing");

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
