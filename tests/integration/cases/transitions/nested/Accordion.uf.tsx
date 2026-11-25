import "./Accordion.css";
import { Transition, ref } from "@uxfront/unframework";

// A transition inside another transition's element: the inner one has one element and no
// `appear`, so it never runs, however often the outer one's element enters.
export default function Accordion() {
  const open = ref(true);

  return (
    <section aria-label="Shipping">
      <button type="button" aria-expanded={open.value} onClick={() => (open.value = !open.value)}>
        Shipping
      </button>
      <Transition name="outer">
        {open.value && (
          <div class="panel">
            <Transition name="inner">
              <p class="note">Ships in two days.</p>
            </Transition>
          </div>
        )}
      </Transition>
    </section>
  );
}
