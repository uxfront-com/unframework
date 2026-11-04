import { useLayoutEffect, useRef, useState } from "react";

const step = 1;

export function useCounter(limit: number, onLimit: (count: number) => void) {
  const onLimitRef = useRef(onLimit);
  useLayoutEffect(() => {
    onLimitRef.current = onLimit;
  });

  const [count, setCount] = useState(0);
  const countRef = useRef(count);

  const [currentCount] = useState(() => () => countRef.current);

  const [increment] = useState(() => () => {
    countRef.current += step;
    setCount(countRef.current);
    if (countRef.current === limit) onLimitRef.current(countRef.current);
  });

  const [reset] = useState(() => () => {
    countRef.current = 0;
    setCount(countRef.current);
  });

  return { count, currentCount, step, increment, reset };
}
