import { useMemo, useRef, useState } from "react";

export interface CounterProps {
  initial?: number;
  step?: number;
}

export interface CounterEvents {
  onChange?: (value: number) => void;
}

export default function Counter({ initial = 0, step = 1, onChange }: CounterProps & CounterEvents) {
  const [count, setCount] = useState(initial);
  const countRef = useRef(count);
  const doubled = useMemo(() => count * 2, [count]);

  function increment() {
    countRef.current += step;
    setCount(countRef.current);
    onChange?.(countRef.current);
  }

  return (
    <div className="counter">
      <output>{count}</output>
      {doubled > 10 ? <span>Big</span> : null}
      <button type="button" onClick={increment}>
        +{step}
      </button>
    </div>
  );
}
