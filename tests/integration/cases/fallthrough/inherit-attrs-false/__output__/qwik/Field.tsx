import { type Signal, component$ } from "@qwik.dev/core";

export default component$<{ label: string } & { ref?: Signal<Element | undefined> }>(
  ({ label, ref }) => {
    return (
      <label class="field" ref={ref}>
        {label} <input name={label.toLowerCase()} />
      </label>
    );
  },
);
