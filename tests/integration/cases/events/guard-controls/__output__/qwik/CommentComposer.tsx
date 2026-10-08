import { $, type QRL, component$, sync$, useSignal } from "@qwik.dev/core";

export interface CommentComposerEvents {
  onSent$?: QRL<(text: string) => void>;
  onSaved$?: QRL<(count: number) => void>;
  onFirstSave$?: QRL<() => void>;
}

export default component$<CommentComposerEvents>(({ onSent$, onSaved$, onFirstSave$ }) => {
  const tags = useSignal<string[]>([]);
  const query = useSignal("");
  const panelOpen = useSignal(true);
  const confirming = useSignal(true);
  const tipShown = useSignal(true);
  const saves = useSignal(0);
  const log = useSignal<string[]>([]);
  const finishUpload = useSignal<(() => void) | undefined>();

  const record = $((line: string) => {
    log.value = [...log.value, line];
  });

  const send = $((event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    onSent$?.((event.target as HTMLTextAreaElement).value);
  });

  const addTag = $((event: KeyboardEvent) => {
    const field = event.target as HTMLInputElement;
    if (field.value === "" || tags.value.includes(field.value)) return;
    tags.value = [...tags.value, field.value];
    field.value = "";
  });

  return (
    <section class="comment-composer" aria-label="Composer">
      <label>
        Comment
        <textarea
          name="comment"
          onKeyDown$={[
            sync$((event: KeyboardEvent) => {
              if (event.key === "Enter") {
                event.preventDefault();
              }
            }),
            send,
          ]}
        />
      </label>
      <form
        aria-label="Tags"
        preventdefault:submit
        onSubmit$={async () => {
          await record("tags submitted");
        }}
      >
        <label>
          Tag
          <input
            name="tag"
            onKeyDown$={[
              sync$((event: KeyboardEvent) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                }
              }),
              $(async (event: KeyboardEvent) => {
                if (event.key !== "Enter") return;
                await addTag(event);
              }),
            ]}
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
          onKeyDown$={sync$((event: KeyboardEvent) => {
            if (event.key.length === 1 && (event.target as HTMLInputElement).value.length >= 4)
              event.preventDefault();
          })}
        />
      </label>
      <div
        class="panel"
        role="presentation"
        onKeyDown$={(event) => {
          if (event.key === "Escape") panelOpen.value = false;
        }}
      >
        <label>
          Search
          <input
            name="search"
            onInput$={(_, element) => (query.value = (element as HTMLInputElement).value)}
            onKeyDown$={[
              sync$((event: KeyboardEvent) => {
                if (event.key === "Escape" && (event.target as HTMLInputElement).value !== "") {
                  event.stopPropagation();
                }
              }),
              $((event: KeyboardEvent) => {
                if (event.key === "Escape" && (event.target as HTMLInputElement).value !== "") {
                  query.value = "";
                  (event.target as HTMLInputElement).value = "";
                }
              }),
            ]}
          />
        </label>
        <p>{panelOpen.value ? `Searching for: ${query.value}` : "Panel closed"}</p>
      </div>
      <div class="page" role="presentation" onClick$={() => record("page")}>
        {tipShown.value ? (
          <div
            class="tip"
            role="presentation"
            style={{ padding: "12px" }}
            onClick$={[
              sync$((event: PointerEvent, element: Element) => {
                if (event.target === element) {
                  event.stopPropagation();
                }
              }),
              $((event: PointerEvent, element: Element) => {
                if (event.target !== element) return;
                tipShown.value = false;
              }),
            ]}
          >
            Click here to hide this tip.
            <button
              type="button"
              onClick$={() => {
                log.value = [...log.value, "tip button"];
              }}
            >
              More tips
            </button>
          </div>
        ) : null}
        {confirming.value ? (
          <div
            class="backdrop"
            role="presentation"
            data-testid="backdrop"
            style={{ padding: "24px" }}
            onClick$={[
              sync$((event: PointerEvent, element: Element) => {
                if (event.target === element) {
                  event.stopPropagation();
                }
              }),
              $((event: PointerEvent, element: Element) => {
                if (event.target === element) {
                  confirming.value = false;
                  log.value = [...log.value, "dismissed"];
                }
              }),
            ]}
          >
            <div role="dialog" aria-label="Discard draft">
              <p>Discard this draft?</p>
              <button
                type="button"
                onClick$={() => {
                  log.value = [...log.value, "kept"];
                }}
              >
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
        onClick$={(_, element) => {
          if (tags.value.length !== 0) {
            saves.value += 1;
            onSaved$?.(saves.value);
          }
          if (!onceClick.has(element)) {
            onceClick.add(element);
            onFirstSave$?.();
          }
        }}
      >
        Save
      </button>
      <button
        type="button"
        onClick$={(_, element) => {
          void (async () => {
            log.value = [...log.value, "upload started"];
            await new Promise<void>((resolve) => {
              finishUpload.value = resolve;
            });
            log.value = [...log.value, "upload finished"];
          })();
          if (!onceClick_1.has(element)) {
            onceClick_1.add(element);
            log.value = [...log.value, "first upload"];
          }
        }}
      >
        Upload
      </button>
      <button type="button" onClick$={() => finishUpload.value?.()}>
        Finish upload
      </button>
      <ol aria-label="Log">
        {log.value.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ol>
    </section>
  );
});

// The elements each `once` listener ran for: Qwik's listeners have no `once` option.
const onceClick = new WeakSet<Element>();
const onceClick_1 = new WeakSet<Element>();
