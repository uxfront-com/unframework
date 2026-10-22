import { type CSSProperties, useEffect, useEffectEvent, useRef, useState } from "react";

export interface ZoomControlAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ZoomControl({ className, style, ...attributes }: ZoomControlAttributes) {
  const [zoom, setZoom] = useState(100);
  const zoomRef = useRef(zoom);
  const [history, setHistory] = useState<string[]>([]);
  const historyRef = useRef(history);

  const previousZoom = useRef(zoom);
  const onZoomChange = useEffectEvent((value: typeof zoom, previous: typeof zoom) => {
    historyRef.current = [...historyRef.current, `${previous}% to ${value}%`];
    setHistory(historyRef.current);
  });
  useEffect(() => {
    const previous = previousZoom.current;
    if (Object.is(previous, zoom)) return;
    previousZoom.current = zoom;
    onZoomChange(zoom, previous);
  }, [zoom]);

  return (
    <section
      className={cx("zoom-control", className)}
      aria-label="Zoom"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <output>{zoom}%</output>
      <button
        type="button"
        onClick={() => {
          zoomRef.current += 25;
          setZoom(zoomRef.current);
        }}
      >
        Zoom in
      </button>
      <button
        type="button"
        onClick={() => {
          zoomRef.current -= 25;
          setZoom(zoomRef.current);
        }}
      >
        Zoom out
      </button>
      <button
        type="button"
        onClick={() => {
          zoomRef.current = 100;
          setZoom(zoomRef.current);
        }}
      >
        Reset
      </button>
      <ol aria-label="History">
        {history.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
