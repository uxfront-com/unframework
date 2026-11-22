import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface ContactCardProps {
  name: string;
  jobTitle?: string;
  team?: string;
  pronouns?: string;
  phone?: string | null;
}

export interface ContactCardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ContactCard({
  name,
  jobTitle,
  team,
  pronouns,
  phone,
  className,
  style,
  ...attributes
}: ContactCardProps & ContactCardAttributes) {
  return (
    <article
      className={cx("contact-card", className)}
      aria-label={name}
      data-team={team}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <h2 title={pronouns}>{name}</h2>
      <p>{jobTitle}</p>
      <p>Phone: {phone ?? "not listed"}</p>
    </article>
  );
}
