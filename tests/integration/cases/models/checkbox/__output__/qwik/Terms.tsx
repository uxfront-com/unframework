import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const agreed = useSignal(false);

  const currentAgreed = agreed.value;

  return (
    <section aria-label="Terms" class={className} style={style} {...attributes}>
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
});
