import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import { button } from "virtual:styleframe";
import "virtual:styleframe.css";
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
    <article
      className={cx("card", button({ size: "lg", tone: "primary" }), className)}
      style={style}
      data-uf-9cfb6163=""
      {...scopeAttributes(attributes)}
    >
      <h2 className="title" data-uf-9cfb6163="">
        {title}
      </h2>
    </article>
  );
}
