import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import "virtual:styleframe.css";
import "./Panel.uf.tsx.css";

export type PanelAttributes = Omit<ComponentPropsWithRef<"section">, "text" | "children">;

export default function Panel({
  text,
  className,
  style,
  ...attributes
}: { text: string } & PanelAttributes) {
  return (
    <section className={cx("panel", className)} style={style} data-uf-b6be1fd3="" {...attributes}>
      <p className="body" data-uf-b6be1fd3="">
        {text}
      </p>
    </section>
  );
}
