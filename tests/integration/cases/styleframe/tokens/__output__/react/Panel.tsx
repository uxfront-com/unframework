import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import "virtual:styleframe.css";
import "./Panel.uf.tsx.css";

export interface PanelAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Panel({
  text,
  className,
  style,
  ...attributes
}: { text: string } & PanelAttributes) {
  return (
    <section
      className={cx("panel", className)}
      style={style}
      data-uf-b6be1fd3=""
      {...scopeAttributes(attributes)}
    >
      <p className="body" data-uf-b6be1fd3="">
        {text}
      </p>
    </section>
  );
}
