import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, createContext, use } from "react";

export type BadgeAttributes = Omit<ComponentPropsWithRef<"span">, "children">;

export const ToneKey = createContext<string | undefined>(undefined);

export default function Badge({ className, style, ...attributes }: BadgeAttributes) {
  const tone = use(ToneKey) ?? "plain";

  return (
    <span className={cx("badge", className)} style={style} {...attributes}>
      Tone: {tone}
    </span>
  );
}
