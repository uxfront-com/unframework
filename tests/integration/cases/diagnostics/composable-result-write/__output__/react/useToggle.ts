import { useRef, useState } from "react";

export function useToggle(initial: boolean) {
  const [on, setOn] = useState(initial);
  const onRef = useRef(on);

  const [currentOn] = useState(() => () => onRef.current);

  const [toggle] = useState(() => () => {
    onRef.current = !onRef.current;
    setOn(onRef.current);
  });

  return { on, currentOn, toggle };
}
