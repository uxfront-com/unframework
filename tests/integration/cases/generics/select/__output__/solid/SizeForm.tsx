import Select from "./Select";
import { type ComponentProps, type JSX, createSignal } from "solid-js";

type Size = "s" | "m" | "l";

const sizes: Size[] = ["s", "m", "l"];

export default function SizeForm(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [size, setSize] = createSignal<Size>("m");

  return (
    <section aria-label="Size" {...props}>
      <Select label="Size" options={sizes} value={size()} onValueChange={setSize} />
      <output>Chosen: {size()}</output>
    </section>
  );
}
