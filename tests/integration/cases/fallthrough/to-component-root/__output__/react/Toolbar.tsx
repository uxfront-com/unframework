import Primary from "./Primary";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface ToolbarAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Toolbar({ className, style, ...attributes }: ToolbarAttributes) {
  return (
    <div
      role="toolbar"
      aria-label="Actions"
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <Primary text="Save" className="wide" />
    </div>
  );
}
