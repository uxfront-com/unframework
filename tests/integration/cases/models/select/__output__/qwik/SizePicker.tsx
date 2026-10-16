import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    const size = useSignal("m");

    const currentSize = size.value;

    return (
      <section aria-label="Size" class={className} style={style}>
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
