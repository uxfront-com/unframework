import Button from "./Button";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import "./Toolbar.uf.tsx.css";

export type ToolbarAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Toolbar({ className, style, ...attributes }: ToolbarAttributes) {
  return (
    <div
      role="toolbar"
      aria-label="Actions"
      className={cx("toolbar", className)}
      style={style}
      data-uf-a33d603f=""
      {...attributes}
    >
      <Button text="Save" data-uf-a33d603f="" />
      <Button text="Cancel" data-uf-a33d603f="" />
    </div>
  );
}
