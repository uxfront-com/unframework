import { defineEmits, onUnmounted, ref } from "unframework";

export interface AutoRefreshProps {
  /** Milliseconds between two refreshes. */
  interval: number;
}

export default function AutoRefresh({ interval }: AutoRefreshProps) {
  const emit = defineEmits<{ refresh: [count: number] }>();

  const enabled = ref(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  let refreshes = 0;

  function tick() {
    refreshes += 1;
    emit("refresh", refreshes);
  }

  function toggle() {
    if (enabled.value) {
      clearInterval(timer);
      enabled.value = false;
    } else {
      timer = setInterval(tick, interval);
      enabled.value = true;
    }
  }

  onUnmounted(() => {
    clearInterval(timer);
  });

  return (
    <section class="auto-refresh" aria-label="Auto-refresh">
      <button type="button" aria-pressed={enabled.value} onClick={toggle}>
        Auto-refresh
      </button>
      <p role="status">{enabled.value ? "Refreshing" : "Paused"}</p>
    </section>
  );
}
