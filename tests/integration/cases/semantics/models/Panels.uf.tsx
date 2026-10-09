import { ref } from "unframework";

import Disclosure from "./Disclosure.uf.tsx";

export default function Panels() {
  const shipping = ref(true);
  return (
    <section aria-label="Panels">
      <Disclosure title="Shipping" v-model:open={shipping.value} />
      <Disclosure title="Returns" />
      <output>Shipping is {shipping.value ? "open" : "closed"}</output>
      <button type="button" onClick={() => (shipping.value = !shipping.value)}>
        Toggle shipping
      </button>
    </section>
  );
}
