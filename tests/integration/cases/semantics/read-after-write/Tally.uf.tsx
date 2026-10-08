import { defineEmits, ref } from "unframework";

export default function Tally() {
  const emit = defineEmits<{
    total: [value: number];
    steps: [values: number[]];
    logged: [entries: string[]];
  }>();

  const count = ref(0);
  const trail = ref<string[]>([]);

  function addTwice() {
    count.value++;
    count.value++;
    emit("total", count.value);
  }

  function addFive() {
    count.value += 5;
    emit("total", count.value);
  }

  function countUp() {
    const seen: number[] = [];
    for (let step = 0; step < 3; step++) {
      count.value += 1;
      seen.push(count.value);
    }
    emit("steps", seen);
  }

  function addTen() {
    count.value += 10;
  }

  function addTenAndReport() {
    addTen();
    emit("total", count.value);
  }

  function logCapture() {
    trail.value = [...trail.value, "capture"];
  }

  function logBubble() {
    trail.value = [...trail.value, "bubble"];
    emit("logged", trail.value);
  }

  return (
    <section class="tally" aria-label="Tally">
      <p role="status">Count: {count.value}</p>
      <button type="button" onClick={addTwice}>
        Add two
      </button>
      <button type="button" onClick={addFive}>
        Add five
      </button>
      <button type="button" onClick={countUp}>
        Count up three
      </button>
      <button type="button" onClick={addTenAndReport}>
        Add ten
      </button>
      <button type="button" onClickCapture={logCapture} onClick={logBubble}>
        Log the phases
      </button>
      <p>Phases: {trail.value.join(" then ")}</p>
    </section>
  );
}
