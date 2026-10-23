<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface SeatPickerProps {
    pricePerSeat: number;
  }

  type Props = SeatPickerProps & {
    onquote?: (seats: number, total: number, summary: string) => void;
    class?: ClassValue;
    style?: string;
  };

  let { pricePerSeat, onquote, class: className, style, ...attributes }: Props = $props();

  let seats = $state(1);
  const total = $derived(seats * pricePerSeat);
  const summary = $derived(seats === 1 ? `1 seat for ${total}` : `${seats} seats for ${total}`);

  function addSeat() {
    seats += 1;
    onquote?.(seats, total, summary);
  }

  function addGroupWithGuide() {
    seats += 4;
    const groupTotal = total;
    seats += 1;
    onquote?.(seats, total, `${summary}, ${groupTotal} without the guide`);
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["seat-picker", className]}
  aria-label="Seats"
  {style}
  {...scopeAttributes(attributes)}
>
  <p role="status">{summary}</p
  ><button type="button" onclick={addSeat}>Add a seat</button
  ><button type="button" onclick={addGroupWithGuide}>Add a group and a guide</button>
</section>
