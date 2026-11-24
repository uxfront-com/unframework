import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import {
  type CSSProperties,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface UnreadBadgeProps {
  appName: string;
}

export interface UnreadBadgeEvents {
  onTitleChange?: (title: string) => void;
  onTitleRelease?: (title: string) => void;
}

export interface UnreadBadgeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function UnreadBadge({
  appName,
  onTitleChange,
  onTitleRelease,
  className,
  style,
  ...attributes
}: UnreadBadgeProps & UnreadBadgeEvents & UnreadBadgeAttributes) {
  const onTitleReleaseRef = useRef(onTitleRelease);
  useLayoutEffect(() => {
    onTitleReleaseRef.current = onTitleRelease;
  });

  const [unread, setUnread] = useState(0);
  const unreadRef = useRef(unread);

  const onUnreadAppNameChange = useEffectEvent(
    (
      unreadValue: typeof unread,
      appNameValue: typeof appName,
      onCleanup: (cleanup: () => void) => void,
    ) => {
      const title = `(${unreadValue}) ${appNameValue}`;
      onTitleChange?.(title);
      onCleanup(() => {
        onTitleReleaseRef.current?.(title);
      });
    },
  );
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    onUnreadAppNameChange(unread, appName, (cleanup) => void cleanups.push(cleanup));
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [unread, appName]);

  return (
    <section
      className={cx("unread-badge", className)}
      aria-label="Inbox"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <p role="status">{unread} unread</p>
      <button
        type="button"
        onClick={() => {
          unreadRef.current++;
          setUnread(unreadRef.current);
        }}
      >
        Receive a message
      </button>
      <button
        type="button"
        onClick={() => {
          unreadRef.current = 0;
          setUnread(unreadRef.current);
        }}
      >
        Mark all read
      </button>
    </section>
  );
}
