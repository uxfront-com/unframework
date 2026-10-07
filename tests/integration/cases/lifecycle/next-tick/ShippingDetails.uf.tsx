import { defineEmits, nextTick, ref, useTemplateRef } from "unframework";

export default function ShippingDetails() {
  const emit = defineEmits<{ toggled: [items: number] }>();

  const open = ref(false);
  const details = useTemplateRef<HTMLUListElement>();

  async function toggle() {
    open.value = !open.value;
    await nextTick();
    emit("toggled", details.value?.childElementCount ?? 0);
  }

  return (
    <section class="shipping-details" aria-label="Shipping">
      <button type="button" aria-expanded={open.value} onClick={toggle}>
        Shipping details
      </button>
      {open.value && (
        <ul ref={details}>
          <li>Ships in two days</li>
          <li>Free returns</li>
          <li>Tracked delivery</li>
        </ul>
      )}
    </section>
  );
}
