// UF3026 ref-without-value: `{count}` renders the ref, not its value; the safe fix reads
// `count.value`.
import { ref } from "unframework";

export default function Counter() {
  const count = ref(0);

  return (
    <div class="counter">
      <output>{count}</output>
      <button type="button" onClick={() => count.value++}>
        Add one
      </button>
    </div>
  );
}
