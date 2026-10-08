import { $, component$, useComputed$, useSignal, useTask$ } from "@qwik.dev/core";

export interface PriceTagProps {
  /** The unit price, in cents. */
  price: number;
}

function formatCents(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2)}`;
}

export default component$<PriceTagProps>(({ price }) => {
  const quantity = useSignal(1);
  const unit = useSignal(formatCents(price));

  function describe(): string {
    return `${quantity.value} at ${formatCents(price)}`;
  }

  const describeQrl = $((): string => {
    return `${quantity.value} at ${formatCents(price)}`;
  });

  const summary = useSignal(describe());
  const total = useComputed$(() => formatCents(price * quantity.value));
  const last = useSignal("none");

  const previousQuantity = useSignal(() => quantity.value);
  useTask$(
    ({ track }) => {
      const value = track(quantity);
      if (Object.is(value, previousQuantity.value)) return;
      previousQuantity.value = value;
      function describeQrl(): string {
        return `${quantity.value} at ${formatCents(price)}`;
      }

      last.value = describeQrl();
    },
    { deferUpdates: false },
  );

  const add = $(async () => {
    quantity.value++;
    summary.value = await describeQrl();
  });

  return (
    <section class="price-tag" aria-label="Price">
      <p>Unit: {unit.value}</p>
      <p role="status">{summary.value}</p>
      <p>Total: {total.value}</p>
      <p>Last change: {last.value}</p>
      <button type="button" onClick$={add}>
        Add one
      </button>
      <button type="button" onClick$={() => (unit.value = formatCents(price * 2))}>
        Price two
      </button>
    </section>
  );
});
