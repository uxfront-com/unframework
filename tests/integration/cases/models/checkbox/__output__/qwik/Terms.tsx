import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const agreed = useSignal(false);

    const currentAgreed = agreed.value;

    return (
      <section aria-label="Terms" {...scopeAttributes(attributes)} class={className} style={style}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
