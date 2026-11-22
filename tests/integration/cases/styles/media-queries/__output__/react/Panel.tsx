import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
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
    <aside
      className={cx("panel", className)}
      style={style}
      data-uf-48dda3f4=""
      {...scopeAttributes(attributes)}
    >
      <p className="text" data-uf-48dda3f4="">
        {text}
      </p>
    </aside>
  );
}
