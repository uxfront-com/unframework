import type { CSSProperties } from "react";

export interface ContactLineProps {
  name: string;
  phone?: string | null;
  verified?: boolean | null;
}

export interface ContactLineAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ContactLine({
  name,
  phone,
  verified,
  className,
  style,
  ...attributes
}: ContactLineProps & ContactLineAttributes) {
  return (
    <section
      className={cx("contact-line", className)}
      aria-label={name}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <p data-phone={phone === null ? "withheld" : phone}>
        Phone: {phone === null ? "withheld" : (phone ?? "not given yet")}
      </p>
      <p>{verified === null ? "Verification pending" : verified ? "Verified" : "Not verified"}</p>
    </section>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
