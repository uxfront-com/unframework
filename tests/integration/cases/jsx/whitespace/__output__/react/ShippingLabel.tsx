import type { CSSProperties } from "react";

export interface ShippingLabelProps {
  recipient: string;
  street: string;
  city: string;
  postcode: string;
}

export interface ShippingLabelAttributes {
  className?: string;
  style?: CSSProperties;
}

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
      {...scopeAttributes(attributes)}
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
