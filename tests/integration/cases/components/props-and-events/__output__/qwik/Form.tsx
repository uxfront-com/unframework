import Field from "./Field";
import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  { city: string } & Omit<PropsOf<"section">, "city" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ city, class: className, style, ...attributes }) => {
  const cleared = useSignal("nothing");

  const clear = $((label: string) => {
    cleared.value = label;
  });

  return (
    <section aria-label="Address" class={className} style={style} {...attributes}>
      <Field label="Street" onClear$={clear} />
      <Field label={city} tone="warn" onClear$={(label) => clear(label.toUpperCase())} />
      <output>Cleared: {cleared.value}</output>
    </section>
  );
});
