import { useMemo, useRef, useState } from "react";

export interface SeatPickerProps {
  pricePerSeat: number;
}

export interface SeatPickerEvents {
  onQuote?: (seats: number, total: number, summary: string) => void;
}

export default function SeatPicker({ pricePerSeat, onQuote }: SeatPickerProps & SeatPickerEvents) {
  const [seats, setSeats] = useState(1);
  const seatsRef = useRef(seats);
  const total = useMemo(() => seats * pricePerSeat, [seats, pricePerSeat]);

  function currentTotal() {
    return seatsRef.current * pricePerSeat;
  }

  const summary = useMemo(
    () => (seats === 1 ? `1 seat for ${total}` : `${seats} seats for ${total}`),
    [seats, total],
  );

  function currentSummary() {
    return seatsRef.current === 1
      ? `1 seat for ${currentTotal()}`
      : `${seatsRef.current} seats for ${currentTotal()}`;
  }

  function addSeat() {
    seatsRef.current += 1;
    setSeats(seatsRef.current);
    onQuote?.(seatsRef.current, currentTotal(), currentSummary());
  }

  function addGroupWithGuide() {
    seatsRef.current += 4;
    setSeats(seatsRef.current);
    const groupTotal = currentTotal();
    seatsRef.current += 1;
    setSeats(seatsRef.current);
    onQuote?.(
      seatsRef.current,
      currentTotal(),
      `${currentSummary()}, ${groupTotal} without the guide`,
    );
  }

  return (
    <section className="seat-picker" aria-label="Seats">
      <p role="status">{summary}</p>
      <button type="button" onClick={addSeat}>
        Add a seat
      </button>
      <button type="button" onClick={addGroupWithGuide}>
        Add a group and a guide
      </button>
    </section>
  );
}
