import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, createContext, use } from "react";

export interface BadgeAttributes {
  className?: string;
  style?: CSSProperties;
}

export const ToneKey = createContext<string | undefined>(undefined);

export default function Badge({ className, style, ...attributes }: BadgeAttributes) {
  const tone = use(ToneKey) ?? "plain";

  return (
    <span className={cx("badge", className)} style={style} {...scopeAttributes(attributes)}>
      Tone: {tone}
    </span>
  );
}
