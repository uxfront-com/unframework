import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { subscribeNothing } from "./_unframework/subscribeNothing";
import { teleport } from "./_unframework/teleport";
import { type CSSProperties, useRef, useState, useSyncExternalStore } from "react";

export interface NoticeProps {
  message: string;
}

export interface NoticeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Notice({
  message,
  className,
  style,
  ...attributes
}: NoticeProps & NoticeAttributes) {
  const [dismissed, setDismissed] = useState(0);
  const dismissedRef = useRef(dismissed);
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

  return (
    <section
      className={cx("inbox", className)}
      aria-label="Inbox"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <p>Dismissed {dismissed} times</p>
      {mounted
        ? teleport(
            <div data-teleported="true" className="notice">
              <p role="status">
                {message} ({dismissed})
              </p>
              <button
                type="button"
                onClick={() => {
                  dismissedRef.current++;
                  setDismissed(dismissedRef.current);
                }}
              >
                Dismiss
              </button>
            </div>,
            "body",
          )
        : null}
    </section>
  );
}
