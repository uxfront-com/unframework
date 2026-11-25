import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface PlanProps {
  name: string;
  price: number;
  href: string;
  featured?: boolean;
  note?: string;
}

export type PlanAttributes = Omit<
  ComponentPropsWithRef<"article">,
  "name" | "price" | "href" | "featured" | "note" | "children"
>;

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
      {...attributes}
    >
      <h2>{name}</h2>
      <p>{price} EUR a month</p>
      {note ? <p className="note">{note}</p> : <p className="note">No commitment.</p>}
      <a href={href}>Choose {name}</a>
    </article>
  );
}
