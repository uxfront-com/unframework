import Select from "./Select";
import { type ComponentPropsWithRef, useState } from "react";

type Size = "s" | "m" | "l";

export type SizeFormAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

const sizes: Size[] = ["s", "m", "l"];

export default function SizeForm({ className, style, ...attributes }: SizeFormAttributes) {
  const [size, setSize] = useState<Size>("m");

  return (
    <section aria-label="Size" className={className} style={style} {...attributes}>
      <Select label="Size" options={sizes} value={size} onValueChange={setSize} />
      <output>Chosen: {size}</output>
    </section>
  );
}
