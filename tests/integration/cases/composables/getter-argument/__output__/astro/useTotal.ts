export function useTotal(price: () => number, quantity: () => number) {
  const total = price() * quantity();
  const label = `${quantity()} × ${price()} = ${total}`;

  return { total, label };
}
