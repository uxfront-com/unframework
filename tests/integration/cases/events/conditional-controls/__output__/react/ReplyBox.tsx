import { type KeyboardEvent, useRef, useState } from "react";

export default function ReplyBox() {
  const [started, setStarted] = useState(false);
  const startedRef = useRef(started);
  const [suggesting, setSuggesting] = useState(false);
  const suggestingRef = useRef(suggesting);
  const [accepted, setAccepted] = useState(0);
  const acceptedRef = useRef(accepted);

  function accept(event: KeyboardEvent) {
    event.preventDefault();
    suggestingRef.current = false;
    setSuggesting(suggestingRef.current);
    acceptedRef.current += 1;
    setAccepted(acceptedRef.current);
  }

  const keydownOnce = useOnce();

  return (
    <section className="reply-box" aria-label="Reply">
      <label>
        Message
        <textarea
          name="message"
          onKeyDown={(event) => {
            if (!keydownOnce(event)) return;
            if (event.key === "Enter") event.preventDefault();
            startedRef.current = true;
            setStarted(startedRef.current);
          }}
        />
      </label>
      <p>{started ? "Started" : "Not started"}</p>
      <label>
        Answer
        <textarea
          name="answer"
          onKeyDown={(event) => {
            if (suggestingRef.current && event.key === "Enter") accept(event);
          }}
        />
      </label>
      <button
        type="button"
        aria-pressed={suggesting}
        onClick={() => {
          suggestingRef.current = !suggestingRef.current;
          setSuggesting(suggestingRef.current);
        }}
      >
        Suggestions
      </button>
      <p>Accepted: {accepted}</p>
    </section>
  );
}

/** The guard of a listener that runs once per element, as `{ once: true }` makes it. */
function useOnce(): (event: { currentTarget: EventTarget | null }) => boolean {
  const fired = useRef(new WeakSet<EventTarget>());
  return (event) => {
    const target = event.currentTarget;
    if (!target || fired.current.has(target)) return false;
    fired.current.add(target);
    return true;
  };
}
