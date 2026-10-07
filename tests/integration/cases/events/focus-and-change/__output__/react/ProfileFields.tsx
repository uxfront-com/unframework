import { type MouseEvent, useLayoutEffect, useRef, useState } from "react";

export interface ProfileFieldsEvents {
  onFirstNickname?: (nickname: string) => void;
}

export default function ProfileFields({ onFirstNickname }: ProfileFieldsEvents) {
  const onFirstNicknameRef = useRef(onFirstNickname);
  useLayoutEffect(() => {
    onFirstNicknameRef.current = onFirstNickname;
  });

  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef(log);
  const [nickname, setNickname] = useState("");
  const nicknameRef = useRef(nickname);
  const [cardFocuses, setCardFocuses] = useState(0);
  const cardFocusesRef = useRef(cardFocuses);
  const [cardBlurs, setCardBlurs] = useState(0);
  const cardBlursRef = useRef(cardBlurs);

  function record(line: string) {
    logRef.current = [...logRef.current, line];
    setLog(logRef.current);
  }

  function hold(event: MouseEvent) {
    event.preventDefault();
    record("locked click");
  }

  const changeOnce = useOnce();

  const [nameFieldsListeners] = useState(() => (element: Element | null) => {
    const cleanups = [
      listen(element, "focusin", () => record("group focusin")),
      listen(element, "focusout", () => record("group focusout")),
    ];
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  });

  const [nameListeners] = useState(() => (element: Element | null) => {
    const cleanups = [
      listen(element, "focus", () => record("name focus")),
      listen(element, "blur", () => record("name blur")),
    ];
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  });

  const [nicknameListeners] = useState(
    () => (element: Element | null) =>
      listen(element, "change", (event) => {
        nicknameRef.current = (event.currentTarget as HTMLInputElement).value;
        setNickname(nicknameRef.current);
        if (changeOnce(event)) {
          onFirstNicknameRef.current?.((event.currentTarget as HTMLInputElement).value);
        }
      }),
  );

  const [publicListeners] = useState(
    () => (element: Element | null) => listen(element, "change", () => record("public change")),
  );

  const [lockedListeners] = useState(
    () => (element: Element | null) => listen(element, "change", () => record("locked change")),
  );

  return (
    <section className="profile-fields" aria-label="Profile">
      <div className="name-group" role="group" aria-label="Name fields" ref={nameFieldsListeners}>
        <label>
          Name
          <input name="name" ref={nameListeners} />
        </label>
      </div>
      <label>
        Nickname
        <input name="nickname" ref={nicknameListeners} />
      </label>
      <p>Nickname: {nickname}</p>
      <label>
        <input
          type="checkbox"
          name="public"
          onClick={() => record("public click")}
          onInput={() => record("public input")}
          ref={publicListeners}
        />
        Public profile
      </label>
      <label>
        <input type="checkbox" name="locked" onClick={hold} ref={lockedListeners} />
        Locked
      </label>
      <div
        className="card"
        role="group"
        aria-label="Card"
        tabIndex={-1}
        onFocus={(event) => {
          if (event.target !== event.currentTarget) return;
          cardFocusesRef.current++;
          setCardFocuses(cardFocusesRef.current);
        }}
        onBlur={(event) => {
          if (event.target !== event.currentTarget) return;
          cardBlursRef.current++;
          setCardBlurs(cardBlursRef.current);
        }}
      >
        <p>{cardFocuses > cardBlurs ? "Card focused" : "Card not focused"}</p>
        <p>Card blurs: {cardBlurs}</p>
        <button type="button" onClick={() => record("card button")}>
          Inside the card
        </button>
      </div>
      <ol aria-label="Log">
        {log.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Listens to a DOM event natively, where React's synthetic event would not keep the DOM's
 * semantics, and gives back what stops it: the cleanup a ref callback returns.
 */
function listen<K extends keyof HTMLElementEventMap>(
  element: EventTarget | null,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  element?.addEventListener(type, listener as EventListener, options);
  return () => element?.removeEventListener(type, listener as EventListener, options);
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
