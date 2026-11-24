import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface ShippingLabelProps {
  recipient: string;
  street: string;
  city: string;
  postcode: string;
}

export default function ShippingLabel(
  props: ShippingLabelProps &
    Omit<
      ComponentProps<"article">,
      "recipient" | "street" | "city" | "postcode" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "recipient", "street", "city", "postcode", "class");

  return (
    <article
      class={props.class ? `shipping-label ${props.class}` : "shipping-label"}
      aria-label="Shipping label"
      {...others}
    >
      <p>
        <strong>To:</strong> {props.recipient}
      </p>
      <p>
        <span class="shipping-label-city">{props.city}</span>{" "}
        <span class="shipping-label-postcode">{props.postcode}</span>{" "}
        <span class="shipping-label-country">United Kingdom</span>
      </p>
      <p>{"  Handle with care "}</p>
      <pre>
        {props.recipient}
        {["\n"]}
        {props.street}
        {["\n"]}
        {props.city + "  " + props.postcode}
      </pre>
      <pre>{"Parcel:	1 of 2\nWeight:	2.5 kg"}</pre>
      <p>
        Sent by <em>Unframework Ltd</em>
        {", on two\nlines."}
      </p>
    </article>
  );
}
