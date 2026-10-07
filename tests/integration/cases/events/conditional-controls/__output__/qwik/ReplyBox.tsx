import { $, component$, sync$, useSignal } from "@qwik.dev/core";

export default component$(() => {
  const started = useSignal(false);
  const suggesting = useSignal(false);
  const accepted = useSignal(0);

  const accept = $((_event: KeyboardEvent) => {
    suggesting.value = false;
    accepted.value += 1;
  });

  return (
    <section class="reply-box" aria-label="Reply">
      <label>
        Message
        <textarea
          name="message"
          onKeyDown$={[
            sync$((event: KeyboardEvent) => {
              if (event.key === "Enter") event.preventDefault();
            }),
            $((_: KeyboardEvent, element: Element) => {
              if (onceKeydown.has(element)) return;
              onceKeydown.add(element);
              started.value = true;
            }),
          ]}
        />
      </label>
      <p>{started.value ? "Started" : "Not started"}</p>
      <label>
        Answer
        <textarea
          name="answer"
          onKeyDown$={async (event) => {
            if (suggesting.value && event.key === "Enter") await accept(event);
          }}
        />
      </label>
      <button
        type="button"
        aria-pressed={suggesting.value}
        onClick$={() => (suggesting.value = !suggesting.value)}
      >
        Suggestions
      </button>
      <p>Accepted: {accepted.value}</p>
    </section>
  );
});

// The elements each `once` listener ran for: Qwik's listeners have no `once` option.
const onceKeydown = new WeakSet<Element>();
