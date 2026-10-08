import { $, component$, useSignal } from "@qwik.dev/core";

export default component$(() => {
  const log = useSignal<string[]>([]);
  const volume = useSignal(5);

  const record = $((line: string) => {
    log.value = [...log.value, line];
  });

  const changeVolume = $((event: WheelEvent) => {
    if (event.deltaY < 0) {
      volume.value += 1;
    } else {
      volume.value -= 1;
    }
  });

  return (
    <section class="event-log" aria-label="Event options">
      <div
        class="panel"
        role="presentation"
        onClick$={() => record("panel bubble")}
        window:onClick$={(event, element) => {
          if (!element.contains(event.target as Node)) return;
          log.value = [...log.value, "panel capture"];
        }}
      >
        <button
          type="button"
          onClick$={() => {
            log.value = [...log.value, "button"];
          }}
        >
          Inside
        </button>
        <button
          type="button"
          stoppropagation:click
          onClick$={() => {
            log.value = [...log.value, "stopped"];
          }}
        >
          Stop here
        </button>
      </div>
      <button
        type="button"
        onClick$={async (_, element) => {
          if (onceClick.has(element)) return;
          onceClick.add(element);
          await record("once");
        }}
      >
        Only once
      </button>
      <div class="reward" role="presentation" onClick$={() => record("outer")}>
        <button
          type="button"
          stoppropagation:click
          onClick$={(_, element) => {
            if (onceClick_1.has(element)) return;
            onceClick_1.add(element);
            element.removeAttribute("stoppropagation:click");
            log.value = [...log.value, "claimed"];
          }}
        >
          Claim the reward
        </button>
      </div>
      <div class="volume" role="group" aria-label="Volume" passive:wheel onWheel$={changeVolume}>
        <output>{volume.value}</output>
      </div>
      <ol aria-label="Log">
        {log.value.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
});

// The elements each `once` listener ran for: Qwik's listeners have no `once` option.
const onceClick = new WeakSet<Element>();
const onceClick_1 = new WeakSet<Element>();
