import { Transition } from "./_unframework/Transition";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";
import "./FadeFace.uf.tsx.css";

export interface FadeFaceSlots {
  children?: ReactNode;
}

export type FadeFaceAttributes = Omit<ComponentPropsWithRef<"div">, "bold" | "children">;

export default function FadeFace({
  bold,
  children,
  className,
  style,
  ...attributes
}: { bold: boolean } & FadeFaceSlots & FadeFaceAttributes) {
  return (
    <div className={cx("fade-face", className)} style={style} data-uf-c9301a2a="" {...attributes}>
      <Transition name="face">
        {bold ? (
          <b key={0} className="face" data-uf-c9301a2a="">
            {children}
          </b>
        ) : (
          <i key={1} className="face" data-uf-c9301a2a="">
            {children}
          </i>
        )}
      </Transition>
    </div>
  );
}
