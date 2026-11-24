<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface SeatPickerProps {
    pricePerSeat: number;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "pricePerSeat" | "onquote" | "children" | "class" | "style" | "ref"
  > &
    SeatPickerProps & {
      onquote?: (seats: number, total: number, summary: string) => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    pricePerSeat,
    onquote,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

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
</script>

<section
  class={["seat-picker", className]}
  aria-label="Seats"
  {style}
  bind:this={ref}
  {...attributes}
>
  <p role="status">{summary}</p
  ><button type="button" onclick={addSeat}>Add a seat</button
  ><button type="button" onclick={addGroupWithGuide}>Add a group and a guide</button>
</section>
