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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
