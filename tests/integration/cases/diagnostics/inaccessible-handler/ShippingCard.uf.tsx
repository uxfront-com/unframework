// UF3030 inaccessible-handler: a click handler on a `<div>`, which a keyboard user cannot reach
// or activate (Svelte's a11y rules); put the handler on a `<button>`.
import { ref } from "unframework";

export default function ShippingCard() {
  const expanded = ref(false);

  return (
    <div class="shipping-card" onClick={() => (expanded.value = !expanded.value)}>
      <h3>Shipping</h3>
      {expanded.value && <p>Ships in two days.</p>}
    </div>
  );
}
