import "./Steps.css";
import { Transition, ref } from "@uxfront/unframework";

// Two conditionals of one tag in a transition each: a ternary swap, and an else-if chain.
export default function Steps() {
  const first = ref(true);
  const step = ref(1);

  return (
    <section class="steps" aria-label="Checkout">
      <button type="button" onClick={() => (first.value = !first.value)}>
        Swap
      </button>
      <Transition name="swap">
        {first.value ? <p class="card">Cart</p> : <p class="card">Payment</p>}
      </Transition>
      <button type="button" onClick={() => (step.value = (step.value % 3) + 1)}>
        Next
      </button>
      <Transition name="step">
        {step.value === 1 ? (
          <p class="step">Step one</p>
        ) : step.value === 2 ? (
          <p class="step">Step two</p>
        ) : (
          <p class="step">Step three</p>
        )}
      </Transition>
    </section>
  );
}
