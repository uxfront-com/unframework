export interface ShippingLabelProps {
  recipient: string;
  street: string;
  city: string;
  postcode: string;
}

export default function ShippingLabel({ recipient, street, city, postcode }: ShippingLabelProps) {
  return (
    <article class="shipping-label" aria-label="Shipping label">
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
      <pre>{"Parcel:\t1 of 2\nWeight:\t2.5 kg"}</pre>
      <p>
        Sent by <em>Unframework Ltd</em>, {"on two\nlines"}.
      </p>
    </article>
  );
}
