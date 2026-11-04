import { useEffect, useEffectEvent, useRef, useState } from "react";

export function useTracked(report: (entry: string) => void) {
  const [count, setCount] = useState(0);
  const countRef = useRef(count);

  const [currentCount] = useState(() => () => countRef.current);

  const previousCount = useRef(count);
  const onCountChange = useEffectEvent(() => report("composable watcher"));
  useEffect(() => {
    const previous = previousCount.current;
    if (Object.is(previous, count)) return;
    previousCount.current = count;
    onCountChange();
  }, [count]);

  const onMount = useEffectEvent(() => report("composable mounted"));
  useEffect(() => {
    onMount();
  }, []);

  const [increment] = useState(() => () => {
    countRef.current++;
    setCount(countRef.current);
  });

  return { count, currentCount, increment };
}
