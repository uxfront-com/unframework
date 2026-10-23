import Disclosure from "./Disclosure";
import { type CSSProperties, useRef, useState } from "react";

export interface PanelsAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Panels({ className, style, ...attributes }: PanelsAttributes) {
  const [shipping, setShipping] = useState(true);
  const shippingRef = useRef(shipping);

  return (
    <section
      aria-label="Panels"
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <Disclosure
        title="Shipping"
        open={shipping}
        onOpenChange={(value) => {
          shippingRef.current = value;
          setShipping(shippingRef.current);
        }}
      />
      <Disclosure title="Returns" />
      <output>Shipping is {shipping ? "open" : "closed"}</output>
      <button
        type="button"
        onClick={() => {
          shippingRef.current = !shippingRef.current;
          setShipping(shippingRef.current);
        }}
      >
        Toggle shipping
      </button>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
