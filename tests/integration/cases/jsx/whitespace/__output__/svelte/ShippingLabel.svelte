<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface ShippingLabelProps {
    recipient: string;
    street: string;
    city: string;
    postcode: string;
  }

  let { recipient, street, city, postcode }: ShippingLabelProps = $props();
</script>

<article class="shipping-label" aria-label="Shipping label">
  <p><strong>To:</strong> {recipient}</p
  ><p>
    <span class="shipping-label-city">{city}</span> <span
      class="shipping-label-postcode"
    >{postcode}</span> <span class="shipping-label-country">United Kingdom</span>
  </p
  ><p>{"  Handle with care "}</p
  ><pre>{recipient}
{street}
{city + "  " + postcode}</pre
  ><pre>Parcel:	1 of 2
Weight:	2.5 kg</pre
  ><p>Sent by <em>Unframework Ltd</em>{", on two\nlines."}</p>
</article>
