import { useEffect, useEffectEvent, useRef, useState } from "react";

export default function ZoomControl() {
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
    <section className="zoom-control" aria-label="Zoom">
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
