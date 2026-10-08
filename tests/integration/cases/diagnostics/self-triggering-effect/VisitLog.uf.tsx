// UF2027 self-triggering-effect: the effect writes `history`, which it also reads: Vue ignores an
// effect's own writes while it runs, and the other targets run it again, without end. Watch
// `count` instead: a watcher's callback is untracked.
import { ref, watchEffect } from "unframework";

export default function VisitLog() {
  const count = ref(0);
  const history = ref<number[]>([]);

  watchEffect(() => {
    history.value = [...history.value, count.value];
  });

  return (
    <section class="visit-log" aria-label="Visits">
      <p>{history.value.join(", ")}</p>
      <button type="button" onClick={() => count.value++}>
        Visit
      </button>
    </section>
  );
}
