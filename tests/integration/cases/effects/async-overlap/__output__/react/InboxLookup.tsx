import { useEffect, useEffectEvent, useLayoutEffect, useReducer, useRef, useState } from "react";

export interface InboxLookupEvents {
  onLooked?: (sender: string) => void;
  onDropped?: (sender: string) => void;
  onSorted?: (order: string) => void;
  onScaled?: (order: string) => void;
  onBusy?: (count: number, loading: boolean) => void;
  onFailed?: (message: string, loading: boolean) => void;
  onCounted?: (count: number) => void;
}

export default function InboxLookup({
  onLooked,
  onDropped,
  onSorted,
  onScaled,
  onBusy,
  onFailed,
  onCounted,
}: InboxLookupEvents) {
  const onDroppedRef = useRef(onDropped);
  const onScaledRef = useRef(onScaled);
  useLayoutEffect(() => {
    onDroppedRef.current = onDropped;
    onScaledRef.current = onScaled;
  });

  const [sender, setSender] = useState("");
  const senderRef = useRef(sender);
  const [order, setOrder] = useState("newest");
  const orderRef = useRef(order);
  const [answers, setAnswers] = useState<string[]>([]);
  const answersRef = useRef(answers);
  const [ordering, setOrdering] = useState("none");
  const orderingRef = useRef(ordering);
  const nextTick = useNextTick(
    () => Object.is(answersRef.current, answers) && Object.is(orderingRef.current, ordering),
  );
  const [messages, setMessages] = useState<string[]>([]);
  const messagesRef = useRef(messages);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(loading);
  const [failure, setFailure] = useState("");
  const failureRef = useRef(failure);
  const [unread, setUnread] = useState(0);
  const unreadRef = useRef(unread);
  const lookupReplies = useRef<((text: string) => void)[]>([]);
  const orderReply = useRef<((text: string) => void) | undefined>(undefined);
  const respond = useRef<((list: string[]) => void) | undefined>(undefined);
  const fail = useRef<((error: Error) => void) | undefined>(undefined);

  function lookupReply(): Promise<string> {
    return new Promise<string>((resolve) => {
      lookupReplies.current = [...lookupReplies.current, resolve];
    });
  }

  function answerLookups() {
    const waiting = lookupReplies.current;
    lookupReplies.current = [];
    waiting.forEach((resolve) => resolve("found"));
  }

  function request(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      respond.current = resolve;
      fail.current = reject;
    });
  }

  const previousSender = useRef(sender);
  const onSenderChange = useEffectEvent(
    async (
      value: typeof sender,
      previous: typeof sender,
      onCleanup: (cleanup: () => void) => void,
    ) => {
      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
        onDroppedRef.current?.(value);
      });
      onLooked?.(value);
      const text = await lookupReply();
      if (!cancelled) {
        answersRef.current = [...answersRef.current, `${value}: ${text}`];
        setAnswers(answersRef.current);
      }
    },
  );
  useEffect(() => {
    const previous = previousSender.current;
    if (Object.is(previous, sender)) return;
    previousSender.current = sender;
    const cleanups: (() => void)[] = [];
    onSenderChange(sender, previous, (cleanup) => void cleanups.push(cleanup));
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [sender]);

  const previousMessagesLoading = useRef<[typeof messages, typeof loading]>([messages, loading]);
  const onMessagesLoadingChange = useEffectEvent(
    ([list, busy]: [typeof messages, typeof loading]) => {
      onBusy?.(list.length, busy);
    },
  );
  useEffect(() => {
    const previous = previousMessagesLoading.current;
    if (Object.is(previous[0], messages) && Object.is(previous[1], loading)) return;
    previousMessagesLoading.current = [messages, loading];
    onMessagesLoadingChange([messages, loading]);
  }, [messages, loading]);

  const previousFailureLoading = useRef<[typeof failure, typeof loading]>([failure, loading]);
  const onFailureLoadingChange = useEffectEvent(
    ([message, busy]: [typeof failure, typeof loading]) => {
      onFailed?.(message, busy);
    },
  );
  useEffect(() => {
    const previous = previousFailureLoading.current;
    if (Object.is(previous[0], failure) && Object.is(previous[1], loading)) return;
    previousFailureLoading.current = [failure, loading];
    onFailureLoadingChange([failure, loading]);
  }, [failure, loading]);

  const previousUnread = useRef(unread);
  const onUnreadChange = useEffectEvent((value: typeof unread) => {
    onCounted?.(value);
  });
  useEffect(() => {
    const previous = previousUnread.current;
    if (Object.is(previous, unread)) return;
    previousUnread.current = unread;
    onUnreadChange(unread);
  }, [unread]);

  const [waits, setWaits] = useState(0);
  const previousOrder = useRef<[typeof order] | undefined>(undefined);
  const orderCleanups = useRef<(() => void)[]>([]);
  const onOrderChange = useEffectEvent(
    async (orderValue: typeof order, onCleanup: (cleanup: () => void) => void) => {
      const current = orderValue;
      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
      });
      onSorted?.(current);
      const text = await new Promise<string>((resolve) => {
        orderReply.current = resolve;
      });
      if (!cancelled) {
        orderingRef.current = `${current} ${text}`;
        setOrdering(orderingRef.current);
        onScaledRef.current?.(current);
      }
    },
  );
  useEffect(() => {
    if (!Object.is(answersRef.current, answers)) {
      setWaits(waits + 1);
      return;
    }
    const previous = previousOrder.current;
    if (previous && Object.is(previous[0], order)) return;
    previousOrder.current = [order];
    for (const cleanup of orderCleanups.current.splice(0)) cleanup();
    onOrderChange(order, (cleanup) => void orderCleanups.current.push(cleanup));
  }, [order, answers, waits]);
  useEffect(
    () => () => {
      previousOrder.current = undefined;
      for (const cleanup of orderCleanups.current.splice(0)) cleanup();
    },
    [],
  );

  async function load() {
    loadingRef.current = true;
    setLoading(loadingRef.current);
    failureRef.current = "";
    setFailure(failureRef.current);
    try {
      const list = await request();
      messagesRef.current = list;
      setMessages(messagesRef.current);
    } catch (error) {
      failureRef.current = error instanceof Error ? error.message : "unknown";
      setFailure(failureRef.current);
    }
    loadingRef.current = false;
    setLoading(loadingRef.current);
  }

  async function refresh() {
    loadingRef.current = true;
    setLoading(loadingRef.current);
    messagesRef.current = await request();
    setMessages(messagesRef.current);
    loadingRef.current = false;
    setLoading(loadingRef.current);
  }

  async function markTwice() {
    const bump = () => {
      unreadRef.current += 1;
      setUnread(unreadRef.current);
    };
    bump();
    bump();
    await nextTick();
    bump();
    bump();
  }

  return (
    <section className="inbox-lookup" aria-label="Inbox">
      <button
        type="button"
        onClick={() => {
          senderRef.current = "Ann";
          setSender(senderRef.current);
        }}
      >
        Find Ann
      </button>
      <button
        type="button"
        onClick={() => {
          senderRef.current = "Anna";
          setSender(senderRef.current);
        }}
      >
        Find Anna
      </button>
      <button type="button" onClick={answerLookups}>
        Answer lookups
      </button>
      <ol aria-label="Answers">
        {answers.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => {
          orderRef.current = orderRef.current === "newest" ? "oldest" : "newest";
          setOrder(orderRef.current);
        }}
      >
        Switch order
      </button>
      <button type="button" onClick={() => orderReply.current?.("ready")}>
        Answer order
      </button>
      <p>Order: {ordering}</p>
      <button type="button" onClick={load}>
        Load
      </button>
      <button type="button" onClick={refresh}>
        Refresh
      </button>
      <button type="button" onClick={() => respond.current?.(["Hello", "Welcome"])}>
        Reply
      </button>
      <button type="button" onClick={() => fail.current?.(new Error("offline"))}>
        Fail
      </button>
      <p role="status">
        {loading ? "Loading" : `${messages.length} messages`}
        {failure === "" ? "" : `, ${failure}`}
      </p>
      <button type="button" onClick={markTwice}>
        Mark twice
      </button>
      <p>Unread: {unread}</p>
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
