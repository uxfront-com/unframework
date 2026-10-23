import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const size = useSignal("m");

    const currentSize = size.value;

    return (
      <section aria-label="Size" {...scopeAttributes(attributes)} class={className} style={style}>
        <label>
          Size{" "}
          <select onChange$={(_, element) => (size.value = element.value)}>
            <option selected={currentSize === "s"} value="s">
              Small
            </option>
            <option selected={currentSize === "m"} value="m">
              Medium
            </option>
            <option selected={currentSize === "l"} value="l">
              Large
            </option>
          </select>
        </label>
        <output>Chosen: {size.value}</output>
        <button type="button" onClick$={() => (size.value = "l")}>
          Largest
        </button>
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
