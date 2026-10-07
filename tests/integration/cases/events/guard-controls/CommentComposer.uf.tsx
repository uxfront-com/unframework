import { defineEmits, ref } from "unframework";

export default function CommentComposer() {
  const emit = defineEmits<{
    sent: [text: string];
    saved: [count: number];
    firstSave: [];
  }>();

  const tags = ref<string[]>([]);
  const query = ref("");
  const panelOpen = ref(true);
  const confirming = ref(true);
  const tipShown = ref(true);
  const saves = ref(0);
  const log = ref<string[]>([]);
  let finishUpload: (() => void) | undefined;

  function record(line: string) {
    log.value = [...log.value, line];
  }

  function send(event: KeyboardEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    emit("sent", (event.target as HTMLTextAreaElement).value);
  }

  function addTag(event: KeyboardEvent) {
    event.preventDefault();
    const field = event.target as HTMLInputElement;
    if (field.value === "" || tags.value.includes(field.value)) return;
    tags.value = [...tags.value, field.value];
    field.value = "";
  }

  function clearSearch(event: KeyboardEvent) {
    event.stopPropagation();
    query.value = "";
    (event.target as HTMLInputElement).value = "";
  }

  function dismiss(event: MouseEvent) {
    event.stopPropagation();
    confirming.value = false;
    record("dismissed");
  }

  return (
    <section class="comment-composer" aria-label="Composer">
      <label>
        Comment
        <textarea name="comment" onKeydown={send} />
      </label>
      <form
        aria-label="Tags"
        onSubmit={(event) => {
          event.preventDefault();
          record("tags submitted");
        }}
      >
        <label>
          Tag
          <input
            name="tag"
            onKeydown={(event) => {
              if (event.key !== "Enter") return;
              addTag(event);
            }}
          />
        </label>
        <button type="submit">Save tags</button>
      </form>
      <ul aria-label="Tag list">
        {tags.value.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
      <label>
        Code
        <input
          name="code"
          onKeydown={(event) => {
            if (event.key.length === 1 && (event.target as HTMLInputElement).value.length >= 4)
              event.preventDefault();
          }}
        />
      </label>
      <div
        class="panel"
        role="presentation"
        onKeydown={(event) => {
          if (event.key === "Escape") panelOpen.value = false;
        }}
      >
        <label>
          Search
          <input
            name="search"
            onInput={(event) => (query.value = (event.currentTarget as HTMLInputElement).value)}
            onKeydown={(event) => {
              if (event.key === "Escape" && (event.target as HTMLInputElement).value !== "")
                clearSearch(event);
            }}
          />
        </label>
        <p>{panelOpen.value ? `Searching for: ${query.value}` : "Panel closed"}</p>
      </div>
      <div class="page" role="presentation" onClick={() => record("page")}>
        {tipShown.value ? (
          <div
            class="tip"
            role="presentation"
            style="padding: 12px"
            onClick={(event) => {
              if (event.target !== event.currentTarget) return;
              event.stopPropagation();
              tipShown.value = false;
            }}
          >
            Click here to hide this tip.
            <button type="button" onClick={() => record("tip button")}>
              More tips
            </button>
          </div>
        ) : null}
        {confirming.value ? (
          <div
            class="backdrop"
            role="presentation"
            data-testid="backdrop"
            style="padding: 24px"
            onClick={(event) => {
              if (event.target === event.currentTarget) dismiss(event);
            }}
          >
            <div role="dialog" aria-label="Discard draft">
              <p>Discard this draft?</p>
              <button type="button" onClick={() => record("kept")}>
                Keep
              </button>
            </div>
          </div>
        ) : (
          <p>Draft dismissed</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          if (tags.value.length === 0) return;
          saves.value += 1;
          emit("saved", saves.value);
        }}
        onClickOnce={() => emit("firstSave")}
      >
        Save
      </button>
      <button
        type="button"
        onClick={async () => {
          record("upload started");
          await new Promise<void>((resolve) => {
            finishUpload = resolve;
          });
          record("upload finished");
        }}
        onClickOnce={() => record("first upload")}
      >
        Upload
      </button>
      <button type="button" onClick={() => finishUpload?.()}>
        Finish upload
      </button>
      <ol aria-label="Log">
        {log.value.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ol>
    </section>
  );
}
