import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const colour = useSignal("none");

    return (
      <section
        aria-label="Colours"
        {...scopeAttributes(attributes)}
        class={className}
        style={style}
      >
        <select
          size={3}
          aria-label="Colour"
          onChange$={(_, element) => (colour.value = (element as HTMLSelectElement).value)}
        >
          <option value="red">Red</option>
          <option value="green">Green</option>
          <option value="blue">Blue</option>
        </select>
        <output>Picked: {colour.value}</output>
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
