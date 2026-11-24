import type { ComponentPropsWithRef } from "react";

export interface ContactCardProps {
  name: string;
  jobTitle?: string;
  team?: string;
  pronouns?: string;
  phone?: string | null;
}

export type ContactCardAttributes = Omit<
  ComponentPropsWithRef<"article">,
  "name" | "jobTitle" | "team" | "pronouns" | "phone" | "children"
>;

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
      {...attributes}
    >
      <h2 title={pronouns}>{name}</h2>
      <p>{jobTitle}</p>
      <p>Phone: {phone ?? "not listed"}</p>
    </article>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
