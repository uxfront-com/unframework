import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface ShippingLabelProps {
  recipient: string;
  street: string;
  city: string;
  postcode: string;
}

export default component$<
  ShippingLabelProps &
    Omit<PropsOf<"article">, "recipient" | "street" | "city" | "postcode" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ recipient, street, city, postcode, class: className, style, ...attributes }) => {
  return (
    <article
      class={["shipping-label", className]}
      aria-label="Shipping label"
      style={style}
      {...attributes}
    >
      <p>
        <strong>To:</strong> {recipient}
      </p>
      <p>
        <span class="shipping-label-city">{city}</span>{" "}
        <span class="shipping-label-postcode">{postcode}</span>{" "}
        <span class="shipping-label-country">United Kingdom</span>
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
});
