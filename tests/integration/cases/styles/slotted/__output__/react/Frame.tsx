import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";
import "./Frame.uf.tsx.css";

export interface FrameSlots {
  children?: ReactNode;
  renderLabel?: (props: { text: string }) => ReactNode;
}

export type FrameAttributes = Omit<ComponentPropsWithRef<"figure">, "children" | "renderLabel">;

export default function Frame({
  children,
  renderLabel,
  className,
  style,
  ...attributes
}: FrameSlots & FrameAttributes) {
  return (
    <figure className={cx("frame", className)} style={style} data-uf-9dc516fd="" {...attributes}>
      {children}
      {renderLabel?.({ text: "Harbour at dusk" })}
    </figure>
  );
}
