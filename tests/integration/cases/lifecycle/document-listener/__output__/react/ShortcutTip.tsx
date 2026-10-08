import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

export interface ShortcutTipEvents {
  onDismissed?: () => void;
  onShortcut?: (key: string, count: number) => void;
}

export default function ShortcutTip({ onDismissed, onShortcut: onShortcut_1 }: ShortcutTipEvents) {
  const onDismissedRef = useRef(onDismissed);
  const onShortcutRef = useRef(onShortcut_1);
  useLayoutEffect(() => {
    onDismissedRef.current = onDismissed;
    onShortcutRef.current = onShortcut_1;
  });

  const [open, setOpen] = useState(true);
  const openRef = useRef(open);
  const [enabled, setEnabled] = useState(false);
  const enabledRef = useRef(enabled);
  const [count, setCount] = useState(0);
  const countRef = useRef(count);

  const [onEscape] = useState(() => (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      openRef.current = false;
      setOpen(openRef.current);
      onDismissedRef.current?.();
    }
  });

  const [onShortcut] = useState(() => (event: KeyboardEvent) => {
    if (event.key === "k") {
      countRef.current += 1;
      setCount(countRef.current);
      onShortcutRef.current?.(event.key, countRef.current);
    }
  });

  function toggle() {
    enabledRef.current = !enabledRef.current;
    setEnabled(enabledRef.current);
  }

  const previousEnabled = useRef(enabled);
  const onEnabledChange = useEffectEvent((on: typeof enabled) => {
    if (on) {
      document.addEventListener("keydown", onShortcut);
    } else {
      document.removeEventListener("keydown", onShortcut);
    }
  });
  useEffect(() => {
    const previous = previousEnabled.current;
    if (Object.is(previous, enabled)) return;
    previousEnabled.current = enabled;
    onEnabledChange(enabled);
  }, [enabled]);

  const onMount = useEffectEvent(() => {
    document.addEventListener("keydown", onEscape);
  });
  useEffect(() => {
    onMount();
  }, []);

  const onUnmount = useEffectEvent(() => {
    document.removeEventListener("keydown", onEscape);
    document.removeEventListener("keydown", onShortcut);
  });
  useEffect(() => () => onUnmount(), []);

  return (
    <section className="shortcut-tip" aria-label="Shortcuts">
      <p>{open ? "Press Escape to hide this tip." : "Tip hidden."}</p>
      <button type="button" aria-pressed={enabled} onClick={toggle}>
        Shortcut K
      </button>
      <p role="status">Used: {count}</p>
    </section>
  );
}
