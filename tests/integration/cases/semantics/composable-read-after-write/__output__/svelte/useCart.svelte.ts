export function useCart() {
  let items = $state(0);
  const empty = $derived(items === 0);

  function add(count: number) {
    items += count;
  }

  function clear() {
    items = 0;
  }

  return {
    get items() {
      return items;
    },
    get empty() {
      return empty;
    },
    add,
    clear,
  };
}
