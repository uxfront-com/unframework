import { defineEmits, ref } from "unframework";

// Listeners keep DOM order (ADR-0047): the listeners of one element and event in attribute
// order, before an ancestor's; a capture and a bubble listener on one element, whose bubble
// listener stops propagation, beside a button outside it; an ancestor that reads what a
// descendant's listener wrote through a local function, on the first click of each descendant
// too, whose code may load after the ancestor's, and an async one's synchronous part only; a
// passive inner and a non-passive outer wheel listener; a `once` and a plain submit listener
// that both prevent.
export default function Order() {
  const emit = defineEmits<{ welcomed: []; submitted: [count: number] }>();

  const log = ref<string[]>([]);
  const selected = ref("none");
  const hits = ref(0);
  const count = ref(0);
  const draft = ref("idle");

  function record(line: string) {
    log.value = [...log.value, line];
  }

  function pick(name: string) {
    selected.value = name;
    hits.value++;
  }

  function report() {
    record(`picked ${selected.value} #${hits.value}`);
  }

  return (
    <section aria-label="Order">
      <div role="presentation" onClick={report}>
        <button type="button" onClick={() => pick("alpha")}>
          Alpha
        </button>
        <button type="button" onClick={() => pick("beta")}>
          Beta
        </button>
      </div>
      <div role="presentation" onClick={() => record(`draft ${draft.value}`)}>
        <button
          type="button"
          onClick={async () => {
            draft.value = "saving";
            await new Promise<void>((resolve) => setTimeout(resolve, 500));
            draft.value = "saved";
          }}
        >
          Save draft
        </button>
        <output>{draft.value}</output>
      </div>
      <div role="presentation" onClick={() => record("toolbar")}>
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
      </div>
      <div
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
      <div role="group" aria-label="Outer zone" onWheel={() => record("outer wheel")}>
        <div role="group" aria-label="Inner zone" onWheelPassive={() => record("inner wheel")}>
          Scroll here
        </div>
      </div>
      <form
        aria-label="Sign up"
        onSubmitOnce={(event) => {
          event.preventDefault();
          emit("welcomed");
        }}
        onSubmit={(event) => {
          event.preventDefault();
          count.value++;
          emit("submitted", count.value);
        }}
      >
        <button type="submit">Join</button>
      </form>
      <ol aria-label="Log">
        {log.value.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}
