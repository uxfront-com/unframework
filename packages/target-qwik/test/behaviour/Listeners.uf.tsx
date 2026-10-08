import { defineEmits, ref } from "unframework";

// Events keep DOM semantics (ADR-0047): capture before the target and bubble after it,
// `stopPropagation()` and `preventDefault()` while the event is dispatched, once, passive, and
// `event.currentTarget`.
export default function Listeners() {
  const emit = defineEmits<{ submitted: [value: string] }>();

  const log = ref<string[]>([]);
  const draft = ref("");

  function record(line: string) {
    log.value = [...log.value, line];
  }

  function blockComma(event: KeyboardEvent) {
    if (event.key === ",") event.preventDefault();
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    emit("submitted", draft.value);
  }

  function update(event: InputEvent) {
    draft.value = (event.currentTarget as HTMLInputElement).value;
  }

  return (
    <form aria-label="Listeners" onSubmit={submit}>
      <label>
        Draft
        <input name="draft" onKeydown={blockComma} onInput={update} />
      </label>
      <button type="submit">Send</button>
      <div
        role="presentation"
        onClickCapture={() => record("capture")}
        onClick={() => record("bubble")}
      >
        <button type="button" onClick={() => record("target")}>
          Inside
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            record("stopped");
          }}
        >
          Stop
        </button>
      </div>
      <div role="presentation" onClick={() => record("outer")}>
        <button
          type="button"
          onClickOnce={(event) => {
            event.stopPropagation();
            record("once");
          }}
        >
          Once
        </button>
      </div>
      <div
        role="group"
        aria-label="Wheel"
        onWheelPassive={(event) => record(event.deltaY > 0 ? "down" : "up")}
      >
        Scroll
      </div>
      <a
        href="/elsewhere"
        onClick={(event) => {
          event.preventDefault();
          record("link");
        }}
      >
        Link
      </a>
      <ol aria-label="Log">
        {log.value.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </form>
  );
}
