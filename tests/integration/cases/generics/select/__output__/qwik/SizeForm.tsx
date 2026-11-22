import Select from "./Select";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

type Size = "s" | "m" | "l";

const sizes: Size[] = ["s", "m", "l"];

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const size = useSignal<Size>("m");

  return (
    <section aria-label="Size" class={className} style={style} {...attributes}>
      <Select
        label="Size"
        options={sizes}
        value={size.value}
        onValueChange$={(value) => (size.value = value)}
      />
      <output>Chosen: {size.value}</output>
    </section>
  );
});
