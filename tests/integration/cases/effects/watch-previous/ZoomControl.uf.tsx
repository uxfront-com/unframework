import { ref, watch } from "unframework";

export default function ZoomControl() {
  const zoom = ref(100);
  const history = ref<string[]>([]);

  watch(zoom, (value, previous) => {
    history.value = [...history.value, `${previous}% to ${value}%`];
  });

  return (
    <section class="zoom-control" aria-label="Zoom">
      <output>{zoom.value}%</output>
      <button type="button" onClick={() => (zoom.value += 25)}>
        Zoom in
      </button>
      <button type="button" onClick={() => (zoom.value -= 25)}>
        Zoom out
      </button>
      <button type="button" onClick={() => (zoom.value = 100)}>
        Reset
      </button>
      <ol aria-label="History">
        {history.value.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}
