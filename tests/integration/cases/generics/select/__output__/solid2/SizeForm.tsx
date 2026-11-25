import Select from "./Select";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";

type Size = "s" | "m" | "l";

const sizes: Size[] = ["s", "m", "l"];

export default function SizeForm(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [size, setSize] = createState<Size>("m");

  return (
    <section aria-label="Size" {...props}>
      <Select label="Size" options={sizes} value={size()} onValueChange={setSize} />
      <output>Chosen: {size()}</output>
    </section>
  );
}
