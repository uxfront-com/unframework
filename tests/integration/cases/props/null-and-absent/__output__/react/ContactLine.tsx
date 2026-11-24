import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
