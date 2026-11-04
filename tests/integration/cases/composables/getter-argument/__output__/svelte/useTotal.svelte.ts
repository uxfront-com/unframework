export function useTotal(price: () => number, quantity: () => number) {
  const total = $derived(price() * quantity());
  const label = $derived(`${quantity()} × ${price()} = ${total}`);

  return {
    get total() {
      return total;
    },
    get label() {
      return label;
    },
  };
}
