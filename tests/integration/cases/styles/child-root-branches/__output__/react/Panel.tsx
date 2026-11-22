import Heading from "./Heading";
import Status from "./Status";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import "./Panel.uf.tsx.css";

export interface PanelAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Panel({ className, style, ...attributes }: PanelAttributes) {
  return (
    <section
      className={cx("panel", className)}
      style={style}
      data-uf-34db6205=""
      {...scopeAttributes(attributes)}
    >
      <Heading big={true} text="Release" data-uf-34db6205="" />
      <Heading big={false} text="Notes" data-uf-34db6205="" />
      <Status busy={false} text="Save" data-uf-34db6205="" />
      <Status busy={true} text="Save" data-uf-34db6205="" />
    </section>
  );
}
