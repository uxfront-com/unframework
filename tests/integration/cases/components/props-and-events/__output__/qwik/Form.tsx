import Field from "./Field";
import { $, type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ city: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ city, class: className, style }) => {
    const cleared = useSignal("nothing");

    const clear = $((label: string) => {
      cleared.value = label;
    });

    return (
      <section aria-label="Address" class={className} style={style}>
        <Field label="Street" onClear$={clear} />
        <Field label={city} tone="warn" onClear$={(label) => clear(label.toUpperCase())} />
        <output>Cleared: {cleared.value}</output>
      </section>
    );
  },
);
