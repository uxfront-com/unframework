import { computed, defineEmits, ref } from "unframework";

export interface SeatPickerProps {
  pricePerSeat: number;
}

export default function SeatPicker({ pricePerSeat }: SeatPickerProps) {
  const emit = defineEmits<{ quote: [seats: number, total: number, summary: string] }>();

  const seats = ref(1);
  const total = computed(() => seats.value * pricePerSeat);
  const summary = computed(() =>
    seats.value === 1 ? `1 seat for ${total.value}` : `${seats.value} seats for ${total.value}`,
  );

  function addSeat() {
    seats.value += 1;
    emit("quote", seats.value, total.value, summary.value);
  }

  function addGroupWithGuide() {
    seats.value += 4;
    const groupTotal = total.value;
    seats.value += 1;
    emit("quote", seats.value, total.value, `${summary.value}, ${groupTotal} without the guide`);
  }

  return (
    <section class="seat-picker" aria-label="Seats">
      <p role="status">{summary.value}</p>
      <button type="button" onClick={addSeat}>
        Add a seat
      </button>
      <button type="button" onClick={addGroupWithGuide}>
        Add a group and a guide
      </button>
    </section>
  );
}
