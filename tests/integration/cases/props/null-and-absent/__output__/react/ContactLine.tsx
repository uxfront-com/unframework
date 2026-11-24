import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface ContactLineProps {
  name: string;
  phone?: string | null;
  verified?: boolean | null;
}

export type ContactLineAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "name" | "phone" | "verified" | "children"
>;

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
      {...attributes}
    >
      <p data-phone={phone === null ? "withheld" : phone}>
        Phone: {phone === null ? "withheld" : (phone ?? "not given yet")}
      </p>
      <p>{verified === null ? "Verification pending" : verified ? "Verified" : "Not verified"}</p>
    </section>
  );
}
