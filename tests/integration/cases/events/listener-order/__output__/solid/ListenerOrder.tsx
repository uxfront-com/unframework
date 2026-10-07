import { For, createSignal } from "solid-js";

export default function ListenerOrder() {
  const [log, setLog] = createSignal<string[]>([]);
  const [resets, setResets] = createSignal(0);

  function record(line: string) {
    setLog([...log(), line]);
  }

  return (
    <section class="listener-order" aria-label="Listener order">
      <div class="toolbar" role="presentation" on:click={() => record("toolbar")}>
        <button
          type="button"
          ref={(element) => {
            element.addEventListener("click", () => record("save"));
            element.addEventListener("click", () => record("first save"), { once: true });
          }}
        >
          Save
        </button>
        <button
          type="button"
          ref={(element) => {
            element.addEventListener("click", () => record("first send"), { once: true });
            element.addEventListener("click", () => record("send"));
          }}
        >
          Send
        </button>
        <button
          type="button"
          ref={(element) => {
            element.addEventListener("click", () => record("reset"));
            element.addEventListener("click", () => setResets(resets() + 1), { once: true });
          }}
        >
          Reset
        </button>
      </div>
      <div
        class="panel"
        role="presentation"
        ref={(element) =>
          element.addEventListener("click", () => record("panel capture"), { capture: true })
        }
        on:click={(event) => {
          event.stopPropagation();
          record("panel bubble");
        }}
      >
        <button type="button" on:click={() => record("inside")}>
          Inside
        </button>
      </div>
      <button type="button" on:click={() => record("outside")}>
        Outside
      </button>
      <div
        class="claim"
        role="presentation"
        on:click={{ handleEvent: () => record("claim once"), once: true }}
      >
        <button
          type="button"
          on:click={(event) => {
            event.stopPropagation();
            record("stopped");
          }}
        >
          Stop
        </button>
        <button type="button" on:click={() => record("pass")}>
          Pass
        </button>
      </div>
      <div
        class="outer-zone"
        role="group"
        aria-label="Outer zone"
        onWheel={() => record("outer wheel")}
      >
        <div
          class="inner-zone"
          role="group"
          aria-label="Inner zone"
          on:wheel={{ handleEvent: () => record("inner wheel"), passive: true }}
        >
          Scroll here
        </div>
      </div>
      <p>Resets: {resets()}</p>
      <ol aria-label="Log">
        <For each={log()}>{(entry) => <li>{entry}</li>}</For>
      </ol>
    </section>
  );
}
