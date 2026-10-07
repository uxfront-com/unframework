import { ref } from "unframework";

export default function ReplyBox() {
  const started = ref(false);
  const suggesting = ref(false);
  const accepted = ref(0);

  function accept(event: KeyboardEvent) {
    event.preventDefault();
    suggesting.value = false;
    accepted.value += 1;
  }

  return (
    <section class="reply-box" aria-label="Reply">
      <label>
        Message
        <textarea
          name="message"
          onKeydownOnce={(event) => {
            if (event.key === "Enter") event.preventDefault();
            started.value = true;
          }}
        />
      </label>
      <p>{started.value ? "Started" : "Not started"}</p>
      <label>
        Answer
        <textarea
          name="answer"
          onKeydown={(event) => {
            if (suggesting.value && event.key === "Enter") accept(event);
          }}
        />
      </label>
      <button
        type="button"
        aria-pressed={suggesting.value}
        onClick={() => (suggesting.value = !suggesting.value)}
      >
        Suggestions
      </button>
      <p>Accepted: {accepted.value}</p>
    </section>
  );
}
