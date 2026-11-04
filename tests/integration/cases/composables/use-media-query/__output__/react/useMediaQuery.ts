import { useEffect, useEffectEvent, useRef, useState } from "react";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  const matchesRef = useRef(matches);

  const [currentMatches] = useState(() => () => matchesRef.current);

  const list = useRef<MediaQueryList | undefined>(undefined);

  const [update] = useState(() => () => {
    matchesRef.current = list.current?.matches ?? false;
    setMatches(matchesRef.current);
  });

  const onMount = useEffectEvent(() => {
    list.current = window.matchMedia(query);
    update();
    list.current.addEventListener("change", update);
  });
  useEffect(() => {
    onMount();
  }, []);

  const onUnmount = useEffectEvent(() => {
    list.current?.removeEventListener("change", update);
  });
  useEffect(() => () => onUnmount(), []);

  return { matches, currentMatches };
}
