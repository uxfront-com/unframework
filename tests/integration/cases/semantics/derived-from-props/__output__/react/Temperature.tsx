import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, useEffect, useEffectEvent, useMemo, useRef } from "react";

export interface TemperatureProps {
  celsius: number;
}

export interface TemperatureEvents {
  onReading?: (celsius: number, previous: number) => void;
}

export interface TemperatureAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Temperature({
  celsius,
  onReading,
  className,
  style,
  ...attributes
}: TemperatureProps & TemperatureEvents & TemperatureAttributes) {
  const fahrenheit = useMemo(() => Math.round((celsius * 9) / 5 + 32), [celsius]);
  const level = useMemo(() => (celsius >= 30 ? "hot" : celsius <= 5 ? "cold" : "mild"), [celsius]);

  const previousCelsius = useRef(celsius);
  const onCelsiusChange = useEffectEvent((value: typeof celsius, previous: typeof celsius) => {
    onReading?.(value, previous);
  });
  useEffect(() => {
    const previous = previousCelsius.current;
    if (Object.is(previous, celsius)) return;
    previousCelsius.current = celsius;
    onCelsiusChange(celsius, previous);
  }, [celsius]);

  return (
    <figure
      className={cx("temperature", className)}
      data-level={level}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <p>{celsius} °C</p>
      <p>{fahrenheit} °F</p>
      <figcaption>Feels {level}</figcaption>
    </figure>
  );
}
