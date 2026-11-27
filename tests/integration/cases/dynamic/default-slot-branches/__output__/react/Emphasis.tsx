import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface EmphasisSlots {
  children?: ReactNode;
}

export type EmphasisAttributes = Omit<ComponentPropsWithRef<"p">, "strong" | "children">;

export default function Emphasis({
  strong,
  children,
  className,
  style,
  ...attributes
}: { strong: boolean } & EmphasisSlots & EmphasisAttributes) {
  return (
    <p className={cx("emphasis", className)} style={style} {...attributes}>
      {strong ? <b>{children}</b> : <i>{children}</i>}
    </p>
  );
}
