import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface PlanProps {
  name: string;
  price: number;
  href: string;
  featured?: boolean;
  note?: string;
}

export interface PlanAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Plan({
  name,
  price,
  href,
  featured = false,
  note,
  className,
  style,
  ...attributes
}: PlanProps & PlanAttributes) {
  return (
    <article
      className={cx(featured ? "plan featured" : "plan", className)}
      aria-label={name}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <h2>{name}</h2>
      <p>{price} EUR a month</p>
      {note ? <p className="note">{note}</p> : <p className="note">No commitment.</p>}
      <a href={href}>Choose {name}</a>
    </article>
  );
}
