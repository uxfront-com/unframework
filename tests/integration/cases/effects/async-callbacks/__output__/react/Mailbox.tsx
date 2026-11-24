import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useNextTick } from "./_unframework/useNextTick";
import {
  type CSSProperties,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface MailboxProps {
  folder: string;
}

export interface MailboxEvents {
  onLoaded?: (name: string, unread: number) => void;
  onProgress?: (status: string, attempts: number) => void;
  onSeen?: (text: string) => void;
  onNoted?: (text: string) => void;
}

export interface MailboxAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Mailbox({
  folder,
  onLoaded,
  onProgress,
  onSeen,
  onNoted,
  className,
  style,
  ...attributes
}: MailboxProps & MailboxEvents & MailboxAttributes) {
  const folderRef = useRef(folder);
  const onSeenRef = useRef(onSeen);
  const onNotedRef = useRef(onNoted);
  useLayoutEffect(() => {
    folderRef.current = folder;
    onSeenRef.current = onSeen;
    onNotedRef.current = onNoted;
  });

  const [name, setName] = useState("Loading");
  const nameRef = useRef(name);
  const [unread, setUnread] = useState(0);
  const unreadRef = useRef(unread);
  const [status, setStatus] = useState("idle");
  const statusRef = useRef(status);
  const [attempts, setAttempts] = useState(0);
  const attemptsRef = useRef(attempts);
  const [summary, setSummary] = useState("No messages");
  const summaryRef = useRef(summary);
  const nextTick = useNextTick(
    () =>
      Object.is(nameRef.current, name) &&
      Object.is(unreadRef.current, unread) &&
      Object.is(summaryRef.current, summary),
  );
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const previousNameUnread = useRef<[typeof name, typeof unread]>([name, unread]);
  const onNameUnreadChange = useEffectEvent(
    ([nextName, nextUnread]: [typeof name, typeof unread]) => {
      onLoaded?.(nextName, nextUnread);
    },
  );
  useEffect(() => {
    const previous = previousNameUnread.current;
    if (Object.is(previous[0], name) && Object.is(previous[1], unread)) return;
    previousNameUnread.current = [name, unread];
    onNameUnreadChange([name, unread]);
  }, [name, unread]);

  const previousStatusAttempts = useRef<[typeof status, typeof attempts]>([status, attempts]);
  const onStatusAttemptsChange = useEffectEvent(
    ([nextStatus, nextAttempts]: [typeof status, typeof attempts]) => {
      onProgress?.(nextStatus, nextAttempts);
    },
  );
  useEffect(() => {
    const previous = previousStatusAttempts.current;
    if (Object.is(previous[0], status) && Object.is(previous[1], attempts)) return;
    previousStatusAttempts.current = [status, attempts];
    onStatusAttemptsChange([status, attempts]);
  }, [status, attempts]);

  const previousUnread = useRef(unread);
  const onUnreadChange = useEffectEvent(async (value: typeof unread) => {
    const text = await Promise.resolve(`${value} unread`);
    summaryRef.current = text;
    setSummary(summaryRef.current);
  });
  useEffect(() => {
    const previous = previousUnread.current;
    if (Object.is(previous, unread)) return;
    previousUnread.current = unread;
    onUnreadChange(unread);
  }, [unread]);

  const [waits, setWaits] = useState(0);
  const previousStatusAttempts_1 = useRef<[typeof status, typeof attempts] | undefined>(undefined);
  const onStatusAttemptsChange_1 = useEffectEvent(
    async (statusValue: typeof status, attemptsValue: typeof attempts) => {
      const text = `${statusValue} after ${attemptsValue}`;
      await Promise.resolve();
      onSeenRef.current?.(text);
    },
  );
  useEffect(() => {
    if (!Object.is(summaryRef.current, summary)) {
      setWaits(waits + 1);
      return;
    }
    const previous = previousStatusAttempts_1.current;
    if (previous && Object.is(previous[0], status) && Object.is(previous[1], attempts)) return;
    previousStatusAttempts_1.current = [status, attempts];
    onStatusAttemptsChange_1(status, attempts);
  }, [status, attempts, summary, waits]);

  const onMount = useEffectEvent(async () => {
    await Promise.resolve();
    nameRef.current = folderRef.current;
    setName(nameRef.current);
    unreadRef.current = 3;
    setUnread(unreadRef.current);
  });
  useEffect(() => {
    onMount();
  }, []);

  const onUnmount = useEffectEvent(() => {
    clearInterval(timer.current);
  });
  useEffect(() => () => onUnmount(), []);

  async function save() {
    const label = nameRef.current.trim();
    statusRef.current = `saving ${label}`;
    setStatus(statusRef.current);
    attemptsRef.current += 1;
    setAttempts(attemptsRef.current);
    await nextTick();
    statusRef.current = "saved";
    setStatus(statusRef.current);
  }

  function refreshEverySecond() {
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      nameRef.current = `${folderRef.current} (refreshed)`;
      setName(nameRef.current);
      unreadRef.current += 1;
      setUnread(unreadRef.current);
    }, 1000);
  }

  function markAllRead() {
    queueMicrotask(() => {
      unreadRef.current = 0;
      setUnread(unreadRef.current);
      nameRef.current = `${folderRef.current}, all read`;
      setName(nameRef.current);
    });
  }

  function note() {
    void Promise.resolve().then(() => {
      onNotedRef.current?.(`${nameRef.current}: ${unreadRef.current}`);
    });
  }

  return (
    <section
      className={cx("mailbox", className)}
      aria-label="Mailbox"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <h2>{name}</h2>
      <p role="status">{summary}</p>
      <p>Status: {status}</p>
      <button type="button" onClick={save}>
        Save
      </button>
      <button type="button" onClick={refreshEverySecond}>
        Refresh every second
      </button>
      <button type="button" onClick={markAllRead}>
        Mark all read
      </button>
      <button type="button" onClick={note}>
        Note
      </button>
    </section>
  );
}
