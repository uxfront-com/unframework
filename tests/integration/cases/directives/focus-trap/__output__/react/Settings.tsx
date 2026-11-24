import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useDirective } from "./_unframework/useDirective";
import { vFocusTrap } from "./vFocusTrap";
import { type CSSProperties, type KeyboardEvent, useRef, useState } from "react";

export interface SettingsAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Settings({ className, style, ...attributes }: SettingsAttributes) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);

  function close() {
    openRef.current = false;
    setOpen(openRef.current);
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") close();
  }

  const focusTrapRef = useDirective(vFocusTrap, () => open);

  return (
    <section
      className={cx("settings", className)}
      aria-label="Settings"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <button
        type="button"
        onClick={() => {
          openRef.current = true;
          setOpen(openRef.current);
        }}
      >
        Open
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Preferences"
          tabIndex={-1}
          className="dialog"
          ref={focusTrapRef}
          onKeyDown={onKeydown}
        >
          <button type="button">Theme</button>
          <button type="button">Language</button>
          <button type="button" onClick={close}>
            Close
          </button>
        </div>
      ) : null}
    </section>
  );
}
