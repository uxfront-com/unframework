import { type JSX, createMemo, createSignal } from "solid-js";

export interface SeatPickerProps {
  pricePerSeat: number;
}

export interface SeatPickerEvents {
  onQuote?: (seats: number, total: number, summary: string) => void;
}

export default function SeatPicker(
  props: SeatPickerProps & SeatPickerEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [seats, setSeats] = createSignal(1);
  const total = createMemo(() => seats() * props.pricePerSeat);
  const summary = createMemo(() =>
    seats() === 1 ? `1 seat for ${total()}` : `${seats()} seats for ${total()}`,
  );

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
      style={props.style}
      {...scopeAttributes(props)}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
