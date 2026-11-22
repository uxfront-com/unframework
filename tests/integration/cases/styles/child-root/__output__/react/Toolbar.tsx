import Button from "./Button";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import "./Toolbar.uf.tsx.css";

export interface ToolbarAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Toolbar({ className, style, ...attributes }: ToolbarAttributes) {
  return (
    <div
      role="toolbar"
      aria-label="Actions"
      className={cx("toolbar", className)}
      style={style}
      data-uf-a33d603f=""
      {...scopeAttributes(attributes)}
    >
      <Button text="Save" data-uf-a33d603f="" />
      <Button text="Cancel" data-uf-a33d603f="" />
    </div>
  );
}
