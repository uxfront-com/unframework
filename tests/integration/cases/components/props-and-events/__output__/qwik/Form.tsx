import Field from "./Field";
import { $, type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ city: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ city, class: className, style, ...attributes }) => {
    const cleared = useSignal("nothing");

    const clear = $((label: string) => {
      cleared.value = label;
    });

    return (
      <section
        aria-label="Address"
        {...scopeAttributes(attributes)}
        class={className}
        style={style}
      >
        <Field label="Street" onClear$={clear} />
        <Field label={city} tone="warn" onClear$={(label) => clear(label.toUpperCase())} />
        <output>Cleared: {cleared.value}</output>
      </section>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
