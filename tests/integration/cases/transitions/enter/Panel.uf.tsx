import "./Panel.css";
import { Transition, ref } from "@uxfront/unframework";

// A disclosure whose details enter with the default transition, `v`.
export default function Panel() {
  const open = ref(false);

  return (
    <section class="panel" aria-label="Delivery">
      <button type="button" aria-expanded={open.value} onClick={() => (open.value = !open.value)}>
        Details
      </button>
      <Transition>{open.value && <p class="details">Ships in two days.</p>}</Transition>
    </section>
  );
}
