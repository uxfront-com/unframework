import { ref } from "unframework";

export default function ListenerOrder() {
  const log = ref<string[]>([]);
  const resets = ref(0);

  function record(line: string) {
    log.value = [...log.value, line];
  }

  return (
    <section class="listener-order" aria-label="Listener order">
      <div class="toolbar" role="presentation" onClick={() => record("toolbar")}>
        <button
          type="button"
          onClick={() => record("save")}
          onClickOnce={() => record("first save")}
        >
          Save
        </button>
        <button
          type="button"
          onClickOnce={() => record("first send")}
          onClick={() => record("send")}
        >
          Send
        </button>
        <button
          type="button"
          onClick={() => record("reset")}
          onClickOnce={() => (resets.value += 1)}
        >
          Reset
        </button>
      </div>
      <div
        class="panel"
        role="presentation"
        onClickCapture={() => record("panel capture")}
        onClick={(event) => {
          event.stopPropagation();
          record("panel bubble");
        }}
      >
        <button type="button" onClick={() => record("inside")}>
          Inside
        </button>
      </div>
      <button type="button" onClick={() => record("outside")}>
        Outside
      </button>
      <div class="claim" role="presentation" onClickOnce={() => record("claim once")}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            record("stopped");
          }}
        >
          Stop
        </button>
        <button type="button" onClick={() => record("pass")}>
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
          onWheelPassive={() => record("inner wheel")}
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
}
