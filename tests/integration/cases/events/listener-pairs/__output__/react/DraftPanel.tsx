import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

export interface DraftPanelEvents {
  onSave?: (count: number) => void;
  onStatus?: (value: string) => void;
  onClosed?: (reason: string) => void;
  onKey?: (key: string) => void;
}

export default function DraftPanel({
  onSave,
  onStatus,
  onClosed,
  onKey: onKey_1,
}: DraftPanelEvents) {
  const onClosedRef = useRef(onClosed);
  const onKeyRef = useRef(onKey_1);
  useLayoutEffect(() => {
    onClosedRef.current = onClosed;
    onKeyRef.current = onKey_1;
  });

  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  const [status, setStatus] = useState("draft");
  const statusRef = useRef(status);
  const [saves, setSaves] = useState(0);
  const savesRef = useRef(saves);
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef(log);
  const handle = useRef<HTMLButtonElement>(null);
  const handleElement = useRef<HTMLButtonElement | null>(null);

  function record(line: string) {
    logRef.current = [...logRef.current, line];
    setLog(logRef.current);
  }

  const [onKey] = useState(() => (event: KeyboardEvent) => {
    record(`key ${event.key}`);
    onKeyRef.current?.(event.key);
  });

  const [{ close, onEscape }] = useState(() => {
    function close(reason: string) {
      openRef.current = false;
      setOpen(openRef.current);
      document.removeEventListener("keydown", onEscape);
      onClosedRef.current?.(reason);
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") close("escape");
    }

    return { close, onEscape };
  });

  function show() {
    openRef.current = true;
    setOpen(openRef.current);
    document.addEventListener("keydown", onEscape);
  }

  const [onHandleClick] = useState(() => () => {
    record("handle");
  });

  function save() {
    savesRef.current += 1;
    setSaves(savesRef.current);
    statusRef.current = "saved";
    setStatus(statusRef.current);
    onSave?.(savesRef.current);
  }

  function stop() {
    document.removeEventListener("keydown", onEscape);
    document.removeEventListener("keydown", onKey);
    handleElement.current?.removeEventListener("click", onHandleClick);
  }

  const previousStatus = useRef(status);
  const onStatusChange = useEffectEvent((value: typeof status) => {
    onStatus?.(value);
  });
  useEffect(() => {
    const previous = previousStatus.current;
    if (Object.is(previous, status)) return;
    previousStatus.current = status;
    onStatusChange(status);
  }, [status]);

  const onMount = useEffectEvent(() => {
    handleElement.current = handle.current;
    handleElement.current?.addEventListener("click", onHandleClick);
  });
  useEffect(() => {
    onMount();
  }, []);

  const onUnmount = useEffectEvent(() => stop());
  useEffect(() => () => onUnmount(), []);

  return (
    <section className="draft-panel" aria-label="Draft">
      <button type="button" aria-expanded={open} onClick={show}>
        Options
      </button>
      {open ? (
        <div className="options" role="group" aria-label="Draft options">
          <button type="button" onClick={() => close("button")}>
            Close
          </button>
        </div>
      ) : null}
      <button type="button" onClick={() => document.addEventListener("keydown", onKey)}>
        Listen
      </button>
      <button type="button" onClick={() => document.removeEventListener("keydown", onKey)}>
        Stop listening
      </button>
      <button type="button" ref={handle}>
        Handle
      </button>
      <button type="button" onClick={save}>
        Save
      </button>
      <p role="status">
        {open ? "Options open" : "Options closed"}, {status}
      </p>
      <ol aria-label="Log">
        {log.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ol>
    </section>
  );
}
