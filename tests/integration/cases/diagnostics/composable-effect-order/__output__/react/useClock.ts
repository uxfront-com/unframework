import { useEffect, useEffectEvent, useRef, useState } from "react";

export function useClock() {
  const [started, setStarted] = useState(false);
  const startedRef = useRef(started);

  const [currentStarted] = useState(() => () => startedRef.current);

  const onMount = useEffectEvent(() => {
    startedRef.current = true;
    setStarted(startedRef.current);
  });
  useEffect(() => {
    onMount();
  }, []);

  return { started, currentStarted };
}
