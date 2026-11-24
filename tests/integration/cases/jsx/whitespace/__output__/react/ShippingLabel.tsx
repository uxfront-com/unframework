import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface ShippingLabelProps {
  recipient: string;
  street: string;
  city: string;
  postcode: string;
}

export type ShippingLabelAttributes = Omit<
  ComponentPropsWithRef<"article">,
  "recipient" | "street" | "city" | "postcode" | "children"
>;

export default function ShippingLabel({
  recipient,
  street,
  city,
  postcode,
  className,
  style,
  ...attributes
}: ShippingLabelProps & ShippingLabelAttributes) {
  return (
    <article
      className={cx("shipping-label", className)}
      aria-label="Shipping label"
      style={style}
      {...attributes}
    >
      <p>
        <strong>To:</strong> {recipient}
      </p>
      <p>
        <span className="shipping-label-city">{city}</span>{" "}
        <span className="shipping-label-postcode">{postcode}</span>{" "}
        <span className="shipping-label-country">United Kingdom</span>
      </p>
      <p>{"  Handle with care "}</p>
      <pre>
        {recipient}
        {"\n"}
        {street}
        {"\n"}
        {city + "  " + postcode}
      </pre>
      <pre>{"Parcel:	1 of 2\nWeight:	2.5 kg"}</pre>
      <p>
        Sent by <em>Unframework Ltd</em>
        {", on two\nlines."}
      </p>
    </article>
  );
}
