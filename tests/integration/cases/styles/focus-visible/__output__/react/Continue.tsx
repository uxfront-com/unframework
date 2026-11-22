import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import "./Continue.uf.tsx.css";

export interface ContinueAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Continue({
  text,
  className,
  style,
  ...attributes
}: { text: string } & ContinueAttributes) {
  return (
    <button
      type="button"
      className={cx("continue", className)}
      style={style}
      data-uf-bb3adc28=""
      {...scopeAttributes(attributes)}
    >
      {text}
    </button>
  );
}
