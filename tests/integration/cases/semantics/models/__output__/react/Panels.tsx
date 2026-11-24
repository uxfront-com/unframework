import Disclosure from "./Disclosure";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type PanelsAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Panels({ className, style, ...attributes }: PanelsAttributes) {
  const [shipping, setShipping] = useState(true);
  const shippingRef = useRef(shipping);

  return (
    <section aria-label="Panels" className={className} style={style} {...attributes}>
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
