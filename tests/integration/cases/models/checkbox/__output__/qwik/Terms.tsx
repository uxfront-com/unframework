import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    const agreed = useSignal(false);

    const currentAgreed = agreed.value;

    return (
      <section aria-label="Terms" class={className} style={style}>
        <label>
          <input
            type="checkbox"
            checked={currentAgreed}
            onChange$={(_, element) => (agreed.value = element.checked)}
          />{" "}
          I agree
        </label>
        <output>{agreed.value ? "Agreed" : "Not agreed"}</output>
        <button type="button" onClick$={() => (agreed.value = !agreed.value)}>
          Toggle
        </button>
      </section>
    );
  },
);
