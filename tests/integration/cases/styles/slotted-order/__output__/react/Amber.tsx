import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";
import "./Amber.uf.tsx.css";

export interface AmberSlots {
  children?: ReactNode;
}

export type AmberAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Amber({
  children,
  className,
  style,
  ...attributes
}: AmberSlots & AmberAttributes) {
  return (
    <div className={cx("amber", className)} style={style} data-uf-c97301b3="" {...attributes}>
      {children}
    </div>
  );
}
