export function useCart() {
  const items = 0 as number;
  const empty = items === 0;

  return { items, empty };
}
