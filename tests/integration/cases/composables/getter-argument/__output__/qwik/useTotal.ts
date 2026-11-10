import { type ReadonlySignal, useComputed$ } from "@qwik.dev/core";

export function useTotal(price: ReadonlySignal<number>, quantity: ReadonlySignal<number>) {
  const total = useComputed$(() => price.value * quantity.value);
  const label = useComputed$(() => `${quantity.value} × ${price.value} = ${total.value}`);

  return { total, label };
}
