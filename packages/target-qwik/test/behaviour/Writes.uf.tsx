import { computed, defineEmits, ref } from "unframework";

// Read after write (ADR-0046): in the same function, in a function it calls (a QRL, awaited), after
// `await`, in a deferred callback, and in another listener of the same event.
export default function Writes() {
  const emit = defineEmits<{ read: [where: string, value: number] }>();

  const count = ref(0);
  const doubled = computed(() => count.value * 2);
  const phases = ref<string[]>([]);

  function addTen() {
    count.value += 10;
  }

  async function run() {
    count.value++;
    emit("read", "same", count.value);
    addTen();
    emit("read", "called", count.value);
    emit("read", "derived", doubled.value);
    await Promise.resolve();
    count.value += 1;
    emit("read", "awaited", count.value);
    setTimeout(() => emit("read", "deferred", count.value), 0);
    count.value += 1;
  }

  function logCapture() {
    phases.value = [...phases.value, "capture"];
  }

  function logBubble() {
    phases.value = [...phases.value, "bubble"];
    emit("read", "phases", phases.value.length);
  }

  return (
    <section>
      <p role="status">{count.value}</p>
      <button type="button" onClick={run}>
        Run
      </button>
      <button type="button" onClickCapture={logCapture} onClick={logBubble}>
        Phases
      </button>
      <p>{phases.value.join(" then ")}</p>
    </section>
  );
}
