import { Transition } from "./_unframework/Transition";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";

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
    <div className={cx("fade-face", className)} style={style} {...attributes}>
      <Transition name="face">
        {bold ? (
          <b key={0} className="face">
            {children}
          </b>
        ) : (
          <i key={1} className="face">
            {children}
          </i>
        )}
      </Transition>
    </div>
  );
}
