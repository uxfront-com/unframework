import { component$, useSignal, useTask$ } from "@qwik.dev/core";

export default component$(() => {
  const zoom = useSignal(100);
  const history = useSignal<string[]>([]);

  const previousZoom = useSignal(() => zoom.value);
  useTask$(
    ({ track }) => {
      const value = track(zoom);
      const previous = previousZoom.value;
      if (Object.is(value, previous)) return;
      previousZoom.value = value;
      history.value = [...history.value, `${previous}% to ${value}%`];
    },
    { deferUpdates: false },
  );

  return (
    <section class="zoom-control" aria-label="Zoom">
      <output>{zoom.value}%</output>
      <button type="button" onClick$={() => (zoom.value += 25)}>
        Zoom in
      </button>
      <button type="button" onClick$={() => (zoom.value -= 25)}>
        Zoom out
      </button>
      <button type="button" onClick$={() => (zoom.value = 100)}>
        Reset
      </button>
      <ol aria-label="History">
        {history.value.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
});
