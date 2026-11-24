import Primary from "./Primary";
import type { ComponentPropsWithRef } from "react";

export type ToolbarAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Toolbar({ className, style, ...attributes }: ToolbarAttributes) {
  return (
    <div role="toolbar" aria-label="Actions" className={className} style={style} {...attributes}>
      <Primary text="Save" className="wide" />
    </div>
  );
}
