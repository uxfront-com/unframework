import Primary from "./Primary";
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
