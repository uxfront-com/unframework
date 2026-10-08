import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

export interface PriceRangeProps {
  currency: string;
}

export interface PriceRangeEvents {
  onSpanUpdate?: (span: number) => void;
  onRangeUpdate?: (low: number, high: number) => void;
  onCurrencyUpdate?: (currency: string) => void;
}

export default function PriceRange({
  currency,
  onSpanUpdate,
  onRangeUpdate,
  onCurrencyUpdate,
}: PriceRangeProps & PriceRangeEvents) {
  const [low, setLow] = useState(10);
  const lowRef = useRef(low);
  const [high, setHigh] = useState(50);
  const highRef = useRef(high);

  const watchedSpan = useMemo(() => high - low, [high, low]);
  const previousSpan = useRef(watchedSpan);
  const onSpanChange = useEffectEvent((span: typeof watchedSpan) => {
    onSpanUpdate?.(span);
  });
  useEffect(() => {
    const previous = previousSpan.current;
    if (Object.is(previous, watchedSpan)) return;
    previousSpan.current = watchedSpan;
    onSpanChange(watchedSpan);
  }, [watchedSpan]);

  const previousLowHigh = useRef<[typeof low, typeof high]>([low, high]);
  const onLowHighChange = useEffectEvent(([minimum, maximum]: [typeof low, typeof high]) => {
    onRangeUpdate?.(minimum, maximum);
  });
  useEffect(() => {
    const previous = previousLowHigh.current;
    if (Object.is(previous[0], low) && Object.is(previous[1], high)) return;
    previousLowHigh.current = [low, high];
    onLowHighChange([low, high]);
  }, [low, high]);

  const previousCurrency = useRef(currency);
  const onCurrencyChange = useEffectEvent((value: typeof currency) => {
    onCurrencyUpdate?.(value);
  });
  useEffect(() => {
    const previous = previousCurrency.current;
    if (Object.is(previous, currency)) return;
    previousCurrency.current = currency;
    onCurrencyChange(currency);
  }, [currency]);

  return (
    <section className="price-range" aria-label="Price range">
      <p role="status">
        {low} to {high} {currency}
      </p>
      <button
        type="button"
        onClick={() => {
          lowRef.current += 10;
          setLow(lowRef.current);
          highRef.current += 10;
          setHigh(highRef.current);
        }}
      >
        Shift up
      </button>
      <button
        type="button"
        onClick={() => {
          highRef.current += 10;
          setHigh(highRef.current);
        }}
      >
        Widen
      </button>
    </section>
  );
}
