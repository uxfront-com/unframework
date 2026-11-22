import Hint from "./Hint";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import "./Banner.uf.tsx.css";

export interface BannerAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Banner({
  tip,
  className,
  style,
  ...attributes
}: { tip: string } & BannerAttributes) {
  return (
    <div
      className={cx("banner", className)}
      style={style}
      data-uf-e25060c2=""
      {...scopeAttributes(attributes)}
    >
      <Hint text={tip} data-uf-e25060c2="" />
    </div>
  );
}
