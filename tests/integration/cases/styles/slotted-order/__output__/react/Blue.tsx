import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";
import "./Blue.uf.tsx.css";

export interface BlueSlots {
  children?: ReactNode;
}

export type BlueAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Blue({
  children,
  className,
  style,
  ...attributes
}: BlueSlots & BlueAttributes) {
  return (
    <div className={cx("blue", className)} style={style} data-uf-721c504a="" {...attributes}>
      {children}
    </div>
  );
}
