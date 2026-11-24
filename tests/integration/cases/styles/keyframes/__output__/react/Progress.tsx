import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import "./Progress.uf.tsx.css";

export type ProgressAttributes = Omit<ComponentPropsWithRef<"div">, "label" | "children">;

export default function Progress({
  label,
  className,
  style,
  ...attributes
}: { label: string } & ProgressAttributes) {
  return (
    <div className={cx("progress", className)} style={style} data-uf-0738d8af="" {...attributes}>
      <span className="dot" data-uf-0738d8af="" />
      <span data-uf-0738d8af="">{label}</span>
    </div>
  );
}
