import Select from "./Select";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, useState } from "react";

type Size = "s" | "m" | "l";

export interface SizeFormAttributes {
  className?: string;
  style?: CSSProperties;
}

const sizes: Size[] = ["s", "m", "l"];

export default function SizeForm({ className, style, ...attributes }: SizeFormAttributes) {
  const [size, setSize] = useState<Size>("m");

  return (
    <section aria-label="Size" className={className} style={style} {...scopeAttributes(attributes)}>
      <Select label="Size" options={sizes} value={size} onValueChange={setSize} />
      <output>Chosen: {size}</output>
    </section>
  );
}
