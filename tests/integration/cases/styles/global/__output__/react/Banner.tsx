import Hint from "./Hint";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import "./Banner.uf.tsx.css";

export type BannerAttributes = Omit<ComponentPropsWithRef<"div">, "tip" | "children">;

export default function Banner({
  tip,
  className,
  style,
  ...attributes
}: { tip: string } & BannerAttributes) {
  return (
    <div className={cx("banner", className)} style={style} data-uf-e25060c2="" {...attributes}>
      <Hint text={tip} data-uf-e25060c2="" />
    </div>
  );
}
