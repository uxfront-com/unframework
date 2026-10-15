import Disclosure from "./Disclosure";
import { type CSSProperties, useRef, useState } from "react";

export interface PanelsAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Panels({ className, style }: PanelsAttributes) {
  const [shipping, setShipping] = useState(true);
  const shippingRef = useRef(shipping);

  return (
    <section aria-label="Panels" className={className} style={style}>
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
