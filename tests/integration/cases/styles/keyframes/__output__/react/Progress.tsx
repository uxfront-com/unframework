import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import "./Progress.uf.tsx.css";

export interface ProgressAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Progress({
  label,
  className,
  style,
  ...attributes
}: { label: string } & ProgressAttributes) {
  return (
    <div
      className={cx("progress", className)}
      style={style}
      data-uf-0738d8af=""
      {...scopeAttributes(attributes)}
    >
      <span className="dot" data-uf-0738d8af="" />
      <span data-uf-0738d8af="">{label}</span>
    </div>
  );
}
