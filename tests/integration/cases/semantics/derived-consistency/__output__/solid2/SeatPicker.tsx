import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface SeatPickerProps {
  pricePerSeat: number;
}

export interface SeatPickerEvents {
  onQuote?: (seats: number, total: number, summary: string) => void;
}

export default function SeatPicker(
  props: SeatPickerProps &
    SeatPickerEvents &
    Omit<ComponentProps<"section">, "pricePerSeat" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "pricePerSeat", "onQuote", "class");

  const [seats, setSeats] = createState(1);
  const total = () => seats() * props.pricePerSeat;
  const summary = () =>
    seats() === 1 ? `1 seat for ${total()}` : `${seats()} seats for ${total()}`;

  function addSeat() {
    setSeats(seats() + 1);
    props.onQuote?.(seats(), total(), summary());
  }

  function addGroupWithGuide() {
    setSeats(seats() + 4);
    const groupTotal = total();
    setSeats(seats() + 1);
    props.onQuote?.(seats(), total(), `${summary()}, ${groupTotal} without the guide`);
  }

  return (
    <section
      class={props.class ? `seat-picker ${props.class}` : "seat-picker"}
      aria-label="Seats"
      {...others}
    >
      <p role="status">{summary()}</p>
      <button type="button" onClick={addSeat}>
        Add a seat
      </button>
      <button type="button" onClick={addGroupWithGuide}>
        Add a group and a guide
      </button>
    </section>
  );
}
