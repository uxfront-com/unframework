import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

export interface UnreadBadgeProps {
  appName: string;
}

export interface UnreadBadgeEvents {
  onTitleChange?: (title: string) => void;
  onTitleRelease?: (title: string) => void;
}

export default function UnreadBadge({
  appName,
  onTitleChange,
  onTitleRelease,
}: UnreadBadgeProps & UnreadBadgeEvents) {
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
    <section className="unread-badge" aria-label="Inbox">
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
