import { createSignal } from "solid-js";

export default function ReplyBox() {
  const [started, setStarted] = createSignal(false);
  const [suggesting, setSuggesting] = createSignal(false);
  const [accepted, setAccepted] = createSignal(0);

  function accept(event: KeyboardEvent) {
    event.preventDefault();
    setSuggesting(false);
    setAccepted(accepted() + 1);
  }

  return (
    <section class="reply-box" aria-label="Reply">
      <label>
        Message
        <textarea
          name="message"
          on:keydown={{
            handleEvent: (event) => {
              if (event.key === "Enter") event.preventDefault();
              setStarted(true);
            },
            once: true,
          }}
        />
      </label>
      <p>{started() ? "Started" : "Not started"}</p>
      <label>
        Answer
        <textarea
          name="answer"
          on:keydown={(event) => {
            if (suggesting() && event.key === "Enter") accept(event);
          }}
        />
      </label>
      <button
        type="button"
        aria-pressed={suggesting()}
        onClick={() => setSuggesting(!suggesting())}
      >
        Suggestions
      </button>
      <p>Accepted: {accepted()}</p>
    </section>
  );
}
