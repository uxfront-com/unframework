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
  import type { ClassValue } from "svelte/elements";

  type Props = ShipmentCardProps & { class?: ClassValue; style?: string };

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
    ...attributes
  }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["shipment-card", className]}
  aria-label={reference}
  {style}
  {...scopeAttributes(attributes)}
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
