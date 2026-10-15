import Primary from "./Primary";
import type { CSSProperties } from "react";

export interface ToolbarAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Toolbar({ className, style }: ToolbarAttributes) {
  return (
    <div role="toolbar" aria-label="Actions" className={className} style={style}>
      <Primary text="Save" className="wide" />
    </div>
  );
}
