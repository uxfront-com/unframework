import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";
import "./Mat.uf.tsx.css";

export interface MatSlots {
  children?: ReactNode;
}

export type MatAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Mat({
  children,
  className,
  style,
  ...attributes
}: MatSlots & MatAttributes) {
  return (
    <div className={cx("mat", className)} style={style} data-uf-09929c4a="" {...attributes}>
      {children}
    </div>
  );
}
