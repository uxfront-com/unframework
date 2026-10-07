import { defineEmits, ref } from "unframework";

// Controls and calls where another listener of the dispatch follows (ADR-0047): an Enter guard
// on a field inside a container that listens to the same key, a backdrop and a link that test
// the event's own element, an unawaited async call whose synchronous part the caller reads, an
// expression-bodied async call inside a container, and a listener that returns early merged with
// a `once` listener.
export default function Guards() {
  const emit = defineEmits<{ seen: [status: string]; saved: [count: number]; firstSave: [] }>();

  const log = ref<string[]>([]);
  const status = ref("idle");
  const tags = ref<string[]>([]);
  const saves = ref(0);
  const open = ref(true);

  function record(line: string) {
    log.value = [...log.value, line];
  }

  async function save(name: string) {
    status.value = `saving ${name}`;
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    status.value = `saved ${name}`;
  }

  function start() {
    void save("start");
    emit("seen", status.value);
  }

  function dismiss(event: MouseEvent) {
    event.stopPropagation();
    open.value = false;
  }

  return (
    <section aria-label="Guards">
      <div
        role="presentation"
        onKeydown={(event) => record(`container ${event.key} ${tags.value.length}`)}
      >
        <input
          aria-label="Tag"
          onKeydown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            tags.value = [...tags.value, (event.target as HTMLInputElement).value];
          }}
        />
      </div>
      <div role="presentation" onClick={() => record("page")}>
        {open.value ? (
          <div
            role="presentation"
            data-testid="backdrop"
            style={{ padding: "8px" }}
            onClick={(event) => {
              if (event.target === event.currentTarget) dismiss(event);
            }}
          >
            <button type="button" onClick={() => record("kept")}>
              Keep
            </button>
          </div>
        ) : null}
        <a
          href="#elsewhere"
          onClick={(event) => {
            if (event.target === event.currentTarget) event.preventDefault();
          }}
        >
          Own link
        </a>
        <button type="button" onClick={() => save("inner")}>
          Save
        </button>
      </div>
      <button type="button" onClick={start}>
        Start
      </button>
      <button
        type="button"
        onClick={() => {
          if (tags.value.length === 0) return;
          saves.value += 1;
          emit("saved", saves.value);
        }}
        onClickOnce={() => emit("firstSave")}
      >
        Save tags
      </button>
      <p>Tags: {tags.value.join(", ")}</p>
      <p role="status">{status.value}</p>
      <ol aria-label="Log">
        {log.value.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}
