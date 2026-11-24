import { createState } from "./_unframework/createState";

export function useCart() {
  const [items, setItems] = createState(0);
  const empty = () => items() === 0;

  function add(count: number) {
    setItems(items() + count);
  }

  function clear() {
    setItems(0);
  }

  return { items, empty, add, clear };
}
