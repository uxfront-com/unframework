import { useEffect, useEffectEvent, useMemo, useRef } from "react";

export interface TemperatureProps {
  celsius: number;
}

export interface TemperatureEvents {
  onReading?: (celsius: number, previous: number) => void;
}

export default function Temperature({ celsius, onReading }: TemperatureProps & TemperatureEvents) {
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
    <figure className="temperature" data-level={level}>
      <p>{celsius} °C</p>
      <p>{fahrenheit} °F</p>
      <figcaption>Feels {level}</figcaption>
    </figure>
  );
}
