import { type KeyboardEvent, type MouseEvent, useRef, useState } from "react";

export interface CommentComposerEvents {
  onSent?: (text: string) => void;
  onSaved?: (count: number) => void;
  onFirstSave?: () => void;
}

export default function CommentComposer({ onSent, onSaved, onFirstSave }: CommentComposerEvents) {
  const [tags, setTags] = useState<string[]>([]);
  const tagsRef = useRef(tags);
  const [query, setQuery] = useState("");
  const queryRef = useRef(query);
  const [panelOpen, setPanelOpen] = useState(true);
  const panelOpenRef = useRef(panelOpen);
  const [confirming, setConfirming] = useState(true);
  const confirmingRef = useRef(confirming);
  const [tipShown, setTipShown] = useState(true);
  const tipShownRef = useRef(tipShown);
  const [saves, setSaves] = useState(0);
  const savesRef = useRef(saves);
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef(log);
  const finishUpload = useRef<(() => void) | undefined>(undefined);

  function record(line: string) {
    logRef.current = [...logRef.current, line];
    setLog(logRef.current);
  }

  function send(event: KeyboardEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onSent?.((event.target as HTMLTextAreaElement).value);
  }

  function addTag(event: KeyboardEvent) {
    event.preventDefault();
    const field = event.target as HTMLInputElement;
    if (field.value === "" || tagsRef.current.includes(field.value)) return;
    tagsRef.current = [...tagsRef.current, field.value];
    setTags(tagsRef.current);
    field.value = "";
  }

  function clearSearch(event: KeyboardEvent) {
    event.stopPropagation();
    queryRef.current = "";
    setQuery(queryRef.current);
    (event.target as HTMLInputElement).value = "";
  }

  function dismiss(event: MouseEvent) {
    event.stopPropagation();
    confirmingRef.current = false;
    setConfirming(confirmingRef.current);
    record("dismissed");
  }

  const clickOnce = useOnce();
  const clickOnce_1 = useOnce();

  return (
    <section className="comment-composer" aria-label="Composer">
      <label>
        Comment
        <textarea name="comment" onKeyDown={send} />
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
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              addTag(event);
            }}
          />
        </label>
        <button type="submit">Save tags</button>
      </form>
      <ul aria-label="Tag list">
        {tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
      <label>
        Code
        <input
          name="code"
          onKeyDown={(event) => {
            if (event.key.length === 1 && (event.target as HTMLInputElement).value.length >= 4)
              event.preventDefault();
          }}
        />
      </label>
      <div
        className="panel"
        role="presentation"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            panelOpenRef.current = false;
            setPanelOpen(panelOpenRef.current);
          }
        }}
      >
        <label>
          Search
          <input
            name="search"
            onInput={(event) => {
              queryRef.current = (event.currentTarget as HTMLInputElement).value;
              setQuery(queryRef.current);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && (event.target as HTMLInputElement).value !== "")
                clearSearch(event);
            }}
          />
        </label>
        <p>{panelOpen ? `Searching for: ${query}` : "Panel closed"}</p>
      </div>
      <div className="page" role="presentation" onClick={() => record("page")}>
        {tipShown ? (
          <div
            className="tip"
            role="presentation"
            style={{ padding: "12px" }}
            onClick={(event) => {
              if (event.target !== event.currentTarget) return;
              event.stopPropagation();
              tipShownRef.current = false;
              setTipShown(tipShownRef.current);
            }}
          >
            Click here to hide this tip.
            <button type="button" onClick={() => record("tip button")}>
              More tips
            </button>
          </div>
        ) : null}
        {confirming ? (
          <div
            className="backdrop"
            role="presentation"
            data-testid="backdrop"
            style={{ padding: "24px" }}
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
        onClick={(event) => {
          if (tagsRef.current.length !== 0) {
            savesRef.current += 1;
            setSaves(savesRef.current);
            onSaved?.(savesRef.current);
          }
          if (clickOnce(event)) {
            onFirstSave?.();
          }
        }}
      >
        Save
      </button>
      <button
        type="button"
        onClick={(event) => {
          const clickListener = async () => {
            record("upload started");
            await new Promise<void>((resolve) => {
              finishUpload.current = resolve;
            });
            record("upload finished");
          };
          void clickListener();
          if (clickOnce_1(event)) {
            record("first upload");
          }
        }}
      >
        Upload
      </button>
      <button type="button" onClick={() => finishUpload.current?.()}>
        Finish upload
      </button>
      <ol aria-label="Log">
        {log.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ol>
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
