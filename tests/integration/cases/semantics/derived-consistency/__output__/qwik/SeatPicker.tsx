import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export interface SeatPickerProps {
  pricePerSeat: number;
}

export interface SeatPickerEvents {
  onQuote$?: QRL<(seats: number, total: number, summary: string) => void>;
}

export default component$<
  SeatPickerProps & SeatPickerEvents & { class?: ClassList; style?: CSSProperties }
>(({ pricePerSeat, onQuote$, class: className, style, ...attributes }) => {
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
    <section
      class={["seat-picker", className]}
      aria-label="Seats"
      {...scopeAttributes(attributes)}
      style={style}
    >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
