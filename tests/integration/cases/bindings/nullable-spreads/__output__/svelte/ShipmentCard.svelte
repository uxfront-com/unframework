<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  interface LabelAttributes {
    id: string;
    title?: string;
  }

  interface Parcel {
    label: string;
    tag?: LabelAttributes;
    seal?: LabelAttributes;
  }

  export interface ShipmentCardProps {
    reference: string;
    carrier: LabelAttributes | null;
    eta?: LabelAttributes | null;
    parcel: Parcel;
    tracked: boolean;
    tracking: LabelAttributes;
    stops: (LabelAttributes | undefined)[];
    signature?: LabelAttributes;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    | "reference"
    | "carrier"
    | "eta"
    | "parcel"
    | "tracked"
    | "tracking"
    | "stops"
    | "signature"
    | "children"
    | "class"
    | "style"
    | "ref"
  > &
    ShipmentCardProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    reference,
    carrier,
    eta = null,
    parcel,
    tracked,
    tracking,
    stops,
    signature,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<section
  class={["shipment-card", className]}
  aria-label={reference}
  {style}
  bind:this={ref}
  {...attributes}
>
  <p id={carrier?.id} title={carrier?.title}>Carrier</p
  ><p id={eta?.id} title={eta?.title}>Estimated delivery</p
  ><p id={parcel.tag?.id} title={parcel.tag?.title}>{parcel.label}</p
  ><p
    id={(tracked ? tracking : undefined)?.id}
    title={(tracked ? tracking : undefined)?.title}
  >Live tracking</p
  ><ol>
    {#each stops as stop, index (index)}
      <li id={stop?.id} title={stop?.title}>Stop {index + 1}</li>
    {/each}
  </ol
  >{#if signature}
    <p id={signature.id} title={signature.title}>Signed on delivery</p>
  {/if}{#if !parcel.seal}
    <p>Not sealed</p>
  {:else}
    <p id={parcel.seal.id} title={parcel.seal.title}>Sealed</p>
  {/if}
</section>
