import { useEffect, useEffectEvent, useLayoutEffect, useReducer, useRef, useState } from "react";

export interface MailboxProps {
  folder: string;
}

export interface MailboxEvents {
  onLoaded?: (name: string, unread: number) => void;
  onProgress?: (status: string, attempts: number) => void;
  onSeen?: (text: string) => void;
  onNoted?: (text: string) => void;
}

export default function Mailbox({
  folder,
  onLoaded,
  onProgress,
  onSeen,
  onNoted,
}: MailboxProps & MailboxEvents) {
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
    <section className="mailbox" aria-label="Mailbox">
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

/**
 * Vue's `nextTick` for one component: the promise resolves once React has rendered the writes
 * made before it and run their effects, and `settled` says nothing they wrote waits to render;
 * in the task of a click or a key that wrote, as on Vue. It resolves when the component unmounts
 * too.
 */
function useNextTick(settled: () => boolean = () => true): () => Promise<void> {
  const pending = useRef<{ ticket: number; resolve: () => void }[]>([]);
  const tickets = useRef(0);
  const mounted = useRef(false);
  const [rendered, render] = useReducer(
    (last: number, ticket: number) => Math.max(last, ticket),
    0,
  );
  useEffect(() => {
    if (!pending.current.length) return;
    // Once every effect of the commit has run.
    queueMicrotask(() => {
      if (!settled()) {
        // What the component's effects wrote has yet to render, and may end where it was, when
        // React commits nothing: a render of its own makes the next look certain.
        tickets.current += 1;
        render(tickets.current);
        return;
      }
      const due = pending.current.filter(({ ticket }) => ticket <= rendered);
      pending.current = pending.current.filter(({ ticket }) => ticket > rendered);
      for (const { resolve } of due) resolve();
    });
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (mounted.current) return;
        const due = pending.current;
        pending.current = [];
        for (const { resolve } of due) resolve();
      });
    };
  }, []);
  return () =>
    new Promise<void>((resolve) => {
      tickets.current += 1;
      const ticket = tickets.current;
      pending.current.push({ ticket, resolve });
      render(ticket);
    });
}
