import { $, component$, sync$, useSignal } from "@qwik.dev/core";

export default component$(() => {
  const log = useSignal<string[]>([]);
  const resets = useSignal(0);

  const record = $((line: string) => {
    log.value = [...log.value, line];
  });

  return (
    <section class="listener-order" aria-label="Listener order">
      <div class="toolbar" role="presentation" onClick$={() => record("toolbar")}>
        <button
          type="button"
          onClick$={(_, element) => {
            log.value = [...log.value, "save"];
            if (!onceClick.has(element)) {
              onceClick.add(element);
              log.value = [...log.value, "first save"];
            }
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick$={(_, element) => {
            if (!onceClick_1.has(element)) {
              onceClick_1.add(element);
              log.value = [...log.value, "first send"];
            }
            log.value = [...log.value, "send"];
          }}
        >
          Send
        </button>
        <button
          type="button"
          onClick$={(_, element) => {
            log.value = [...log.value, "reset"];
            if (!onceClick_2.has(element)) {
              onceClick_2.add(element);
              resets.value += 1;
            }
          }}
        >
          Reset
        </button>
      </div>
      <div
        class="panel"
        role="presentation"
        onClick$={[
          sync$((event: PointerEvent) => {
            event.stopPropagation();
          }),
          $(async () => {
            await record("panel bubble");
          }),
        ]}
        window:onClick$={(event, element) => {
          if (!element.contains(event.target as Node)) return;
          log.value = [...log.value, "panel capture"];
        }}
      >
        <button
          type="button"
          onClick$={() => {
            log.value = [...log.value, "inside"];
          }}
        >
          Inside
        </button>
      </div>
      <button type="button" onClick$={() => record("outside")}>
        Outside
      </button>
      <div
        class="claim"
        role="presentation"
        onClick$={async (_, element) => {
          if (onceClick_3.has(element)) return;
          onceClick_3.add(element);
          await record("claim once");
        }}
      >
        <button
          type="button"
          stoppropagation:click
          onClick$={() => {
            log.value = [...log.value, "stopped"];
          }}
        >
          Stop
        </button>
        <button
          type="button"
          onClick$={() => {
            log.value = [...log.value, "pass"];
          }}
        >
          Pass
        </button>
      </div>
      <div
        class="outer-zone"
        role="group"
        aria-label="Outer zone"
        onWheel$={() => record("outer wheel")}
      >
        <div
          class="inner-zone"
          role="group"
          aria-label="Inner zone"
          onWheel$={() => {
            log.value = [...log.value, "inner wheel"];
          }}
        >
          Scroll here
        </div>
      </div>
      <p>Resets: {resets.value}</p>
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
const onceClick_2 = new WeakSet<Element>();
const onceClick_3 = new WeakSet<Element>();
