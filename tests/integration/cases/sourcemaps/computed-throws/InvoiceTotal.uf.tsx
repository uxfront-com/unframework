import { computed, ref } from "@uxfront/unframework";

export interface InvoiceTotalProps {
  quantity: number;
}

export default function InvoiceTotal({ quantity }: InvoiceTotalProps) {
  const refunded = ref(0);
  const total = computed(() => {
    const units = quantity - refunded.value;
    if (units < 0) {
      throw new Error("The total is negative");
    }
    return units * 5;
  });

  function refund() {
    refunded.value = refunded.value + 3;
  }

  return (
    <div>
      <output>{`${total.value} after ${refunded.value} refunded`}</output>
      <button type="button" onClick={refund}>
        Refund
      </button>
    </div>
  );
}
