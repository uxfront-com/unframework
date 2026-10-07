<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface SeatPickerProps {
    pricePerSeat: number;
  }

  type Props = SeatPickerProps & {
    onquote?: (seats: number, total: number, summary: string) => void;
  };

  let { pricePerSeat, onquote }: Props = $props();

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

<section class="seat-picker" aria-label="Seats">
  <p role="status">{summary}</p
  ><button type="button" onclick={addSeat}>Add a seat</button
  ><button type="button" onclick={addGroupWithGuide}>Add a group and a guide</button>
</section>
