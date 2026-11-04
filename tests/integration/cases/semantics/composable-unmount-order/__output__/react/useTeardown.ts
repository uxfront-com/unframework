import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";

export function useTeardown(name: () => string, report: (entry: string) => void) {
  const nameRef = useRef(name);
  useLayoutEffect(() => {
    nameRef.current = name;
  });

  const title = useMemo(() => `Panel ${name()}`, [name]);

  const [currentTitle] = useState(() => () => `Panel ${nameRef.current()}`);

  const onUnmount = useEffectEvent(() => report(`${nameRef.current()} closed`));
  useEffect(() => () => onUnmount(), []);

  return { title, currentTitle };
}
