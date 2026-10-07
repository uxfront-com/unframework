import { $, type QRL, component$, useComputed$, useSignal } from "@qwik.dev/core";

export interface SeatPickerProps {
  pricePerSeat: number;
}

export interface SeatPickerEvents {
  onQuote$?: QRL<(seats: number, total: number, summary: string) => void>;
}

export default component$<SeatPickerProps & SeatPickerEvents>(({ pricePerSeat, onQuote$ }) => {
  const seats = useSignal(1);
  const total = useComputed$(() => seats.value * pricePerSeat);
  const summary = useComputed$(() =>
    seats.value === 1 ? `1 seat for ${total.value}` : `${seats.value} seats for ${total.value}`,
  );

  const addSeat = $(() => {
    seats.value += 1;
    onQuote$?.(seats.value, total.value, summary.value);
  });

  const addGroupWithGuide = $(() => {
    seats.value += 4;
    const groupTotal = total.value;
    seats.value += 1;
    onQuote$?.(seats.value, total.value, `${summary.value}, ${groupTotal} without the guide`);
  });

  return (
    <section class="seat-picker" aria-label="Seats">
      <p role="status">{summary.value}</p>
      <button type="button" onClick$={addSeat}>
        Add a seat
      </button>
      <button type="button" onClick$={addGroupWithGuide}>
        Add a group and a guide
      </button>
    </section>
  );
});
