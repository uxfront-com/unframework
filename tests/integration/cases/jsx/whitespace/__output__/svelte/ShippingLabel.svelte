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
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["article"],
    "recipient" | "street" | "city" | "postcode" | "children" | "class" | "style" | "ref"
  > &
    ShippingLabelProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["article"] | null;
    };

  let {
    recipient,
    street,
    city,
    postcode,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<article
  class={["shipping-label", className]}
  aria-label="Shipping label"
  {style}
  bind:this={ref}
  {...attributes}
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
