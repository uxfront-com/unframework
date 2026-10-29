<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ShippingLabelProps {
    recipient: string;
    street: string;
    city: string;
    postcode: string;
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = ShippingLabelProps & { class?: ClassValue; style?: string };

  let {
    recipient,
    street,
    city,
    postcode,
    class: className,
    style,
    ...attributes
  }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<article
  class={["shipping-label", className]}
  aria-label="Shipping label"
  {style}
  {...scopeAttributes(attributes)}
>
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
