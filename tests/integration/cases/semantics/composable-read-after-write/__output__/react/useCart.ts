import { useMemo, useRef, useState } from "react";

export function useCart() {
  const [items, setItems] = useState(0);
  const itemsRef = useRef(items);

  const [currentItems] = useState(() => () => itemsRef.current);

  const empty = useMemo(() => items === 0, [items]);

  const [currentEmpty] = useState(() => () => itemsRef.current === 0);

  const [add] = useState(() => (count: number) => {
    itemsRef.current += count;
    setItems(itemsRef.current);
  });

  const [clear] = useState(() => () => {
    itemsRef.current = 0;
    setItems(itemsRef.current);
  });

  return { items, currentItems, empty, currentEmpty, add, clear };
}
