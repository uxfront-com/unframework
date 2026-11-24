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
  const colour = useSignal("none");

  return (
    <section aria-label="Colours" class={className} style={style} {...attributes}>
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
});
