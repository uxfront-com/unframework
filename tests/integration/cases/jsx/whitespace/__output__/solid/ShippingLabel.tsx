import type { JSX } from "solid-js";

export interface ShippingLabelProps {
  recipient: string;
  street: string;
  city: string;
  postcode: string;
}

export default function ShippingLabel(
  props: ShippingLabelProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <article
      class={props.class ? `shipping-label ${props.class}` : "shipping-label"}
      aria-label="Shipping label"
      style={props.style}
      {...scopeAttributes(props)}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
