import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import "./Panel.uf.tsx.css";

export type PanelAttributes = Omit<ComponentPropsWithRef<"aside">, "text" | "children">;

export default function Panel({
  text,
  className,
  style,
  ...attributes
}: { text: string } & PanelAttributes) {
  return (
    <aside className={cx("panel", className)} style={style} data-uf-48dda3f4="" {...attributes}>
      <p className="text" data-uf-48dda3f4="">
        {text}
      </p>
    </aside>
  );
}
