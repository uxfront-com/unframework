import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import "./Card.uf.tsx.css";

export interface CardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Card({
  title,
  className,
  style,
  ...attributes
}: { title: string } & CardAttributes) {
  return (
    <section
      className={cx("card", className)}
      style={style}
      data-uf-bb60e985=""
      {...scopeAttributes(attributes)}
    >
      <h2 className="title" data-uf-bb60e985="">
        {title}
      </h2>
    </section>
  );
}
