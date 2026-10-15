import { type CSSProperties, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

export interface PriceRangeProps {
  currency: string;
}

export interface PriceRangeEvents {
  onSpanUpdate?: (span: number) => void;
  onRangeUpdate?: (low: number, high: number) => void;
  onCurrencyUpdate?: (currency: string) => void;
}

export interface PriceRangeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function PriceRange({
  currency,
  onSpanUpdate,
  onRangeUpdate,
  onCurrencyUpdate,
  className,
  style,
}: PriceRangeProps & PriceRangeEvents & PriceRangeAttributes) {
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
    <section className={cx("price-range", className)} aria-label="Price range" style={style}>
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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
