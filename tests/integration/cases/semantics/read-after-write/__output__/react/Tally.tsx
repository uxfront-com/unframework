import { type CSSProperties, useRef, useState } from "react";

export interface TallyEvents {
  onTotal?: (value: number) => void;
  onSteps?: (values: number[]) => void;
  onLogged?: (entries: string[]) => void;
}

export interface TallyAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Tally({
  onTotal,
  onSteps,
  onLogged,
  className,
  style,
}: TallyEvents & TallyAttributes) {
  const [count, setCount] = useState(0);
  const countRef = useRef(count);
  const [trail, setTrail] = useState<string[]>([]);
  const trailRef = useRef(trail);

  function addTwice() {
    countRef.current++;
    setCount(countRef.current);
    countRef.current++;
    setCount(countRef.current);
    onTotal?.(countRef.current);
  }

  function addFive() {
    countRef.current += 5;
    setCount(countRef.current);
    onTotal?.(countRef.current);
  }

  function countUp() {
    const seen: number[] = [];
    for (let step = 0; step < 3; step++) {
      countRef.current += 1;
      setCount(countRef.current);
      seen.push(countRef.current);
    }
    onSteps?.(seen);
  }

  function addTen() {
    countRef.current += 10;
    setCount(countRef.current);
  }

  function addTenAndReport() {
    addTen();
    onTotal?.(countRef.current);
  }

  function logCapture() {
    trailRef.current = [...trailRef.current, "capture"];
    setTrail(trailRef.current);
  }

  function logBubble() {
    trailRef.current = [...trailRef.current, "bubble"];
    setTrail(trailRef.current);
    onLogged?.(trailRef.current);
  }

  return (
    <section className={cx("tally", className)} aria-label="Tally" style={style}>
      <p role="status">Count: {count}</p>
      <button type="button" onClick={addTwice}>
        Add two
      </button>
      <button type="button" onClick={addFive}>
        Add five
      </button>
      <button type="button" onClick={countUp}>
        Count up three
      </button>
      <button type="button" onClick={addTenAndReport}>
        Add ten
      </button>
      <button type="button" onClickCapture={logCapture} onClick={logBubble}>
        Log the phases
      </button>
      <p>Phases: {trail.join(" then ")}</p>
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
