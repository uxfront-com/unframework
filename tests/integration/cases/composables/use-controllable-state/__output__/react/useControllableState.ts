import { useLayoutEffect, useMemo, useRef, useState } from "react";

export function useControllableState<T>(
  value: () => T | undefined,
  initial: T,
  onChange: (next: T) => void,
) {
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  const [local, setLocal] = useState<T>(initial);
  const localRef = useRef(local);
  const current = useMemo(() => value() ?? local, [value, local]);

  const [currentCurrent] = useState(() => () => valueRef.current() ?? localRef.current);

  const [set] = useState(() => (next: T) => {
    localRef.current = next;
    setLocal(localRef.current);
    onChangeRef.current(next);
  });

  return { current, currentCurrent, set };
}
