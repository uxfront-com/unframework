import {
  $,
  type QRL,
  component$,
  noSerialize,
  useConstant,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface InboxLookupEvents {
  onLooked$?: QRL<(sender: string) => void>;
  onDropped$?: QRL<(sender: string) => void>;
  onSorted$?: QRL<(order: string) => void>;
  onScaled$?: QRL<(order: string) => void>;
  onBusy$?: QRL<(count: number, loading: boolean) => void>;
  onFailed$?: QRL<(message: string, loading: boolean) => void>;
  onCounted$?: QRL<(count: number) => void>;
}

export default component$<InboxLookupEvents>(
  ({ onLooked$, onDropped$, onSorted$, onScaled$, onBusy$, onFailed$, onCounted$ }) => {
    const sender = useSignal("");
    const order = useSignal("newest");
    const answers = useSignal<string[]>([]);
    const ordering = useSignal("none");
    const messages = useSignal<string[]>([]);
    const loading = useSignal(false);
    const failure = useSignal("");
    const unread = useSignal(0);
    const lookupReplies = useSignal<((text: string) => void)[]>([]);
    const orderReply = useSignal<((text: string) => void) | undefined>();
    const respond = useSignal<((list: string[]) => void) | undefined>();
    const fail = useSignal<((error: Error) => void) | undefined>();

    const lookupReply = $((): Promise<string> => {
      return new Promise<string>((resolve) => {
        lookupReplies.value = [...lookupReplies.value, resolve];
      });
    });

    const answerLookups = $(() => {
      const waiting = lookupReplies.value;
      lookupReplies.value = [];
      waiting.forEach((resolve) => resolve("found"));
    });

    const request = $((): Promise<string[]> => {
      return new Promise<string[]>((resolve, reject) => {
        respond.value = resolve;
        fail.value = reject;
      });
    });

    const previousSender = useSignal(() => sender.value);
    const senderCleanups = useConstant(() => noSerialize<(() => void)[]>([]));
    useTask$(
      ({ track }) => {
        const value = track(sender);
        if (Object.is(value, previousSender.value)) return;
        previousSender.value = value;
        for (const callback of senderCleanups?.splice(0) ?? []) callback();
        const onCleanup = (callback: () => void) => void senderCleanups?.push(callback);
        void (async () => {
          let cancelled = false;
          onCleanup(() => {
            cancelled = true;
            onDropped$?.(value);
          });
          onLooked$?.(value);
          const text = await lookupReply();
          if (!cancelled) {
            answers.value = [...answers.value, `${value}: ${text}`];
          }
        })();
      },
      { deferUpdates: false },
    );
    useVisibleTask$(
      ({ cleanup }) => {
        cleanup(() => {
          for (const callback of senderCleanups?.splice(0) ?? []) callback();
        });
      },
      { strategy: "document-ready" },
    );

    const previousEffect = useSignal<[typeof order.value]>();
    const effectCleanups = useConstant(() => noSerialize<(() => void)[]>([]));
    useVisibleTask$(
      ({ track }) => {
        const values: [typeof order.value] = [track(order)];
        const last = previousEffect.value;
        if (last && values.every((item, index) => Object.is(item, last[index]))) return;
        previousEffect.value = values;
        for (const callback of effectCleanups?.splice(0) ?? []) callback();
        const onCleanup = (callback: () => void) => void effectCleanups?.push(callback);
        void (async () => {
          const current = order.value;
          let cancelled = false;
          onCleanup(() => {
            cancelled = true;
          });
          onSorted$?.(current);
          const text = await new Promise<string>((resolve) => {
            orderReply.value = resolve;
          });
          if (!cancelled) {
            ordering.value = `${current} ${text}`;
            onScaled$?.(current);
          }
        })();
      },
      { strategy: "document-ready" },
    );
    useVisibleTask$(
      ({ cleanup }) => {
        cleanup(() => {
          for (const callback of effectCleanups?.splice(0) ?? []) callback();
        });
      },
      { strategy: "document-ready" },
    );

    const previousValues = useSignal<[typeof messages.value, typeof loading.value]>(() => [
      messages.value,
      loading.value,
    ]);
    useTask$(
      ({ track }) => {
        const values: [typeof messages.value, typeof loading.value] = [
          track(messages),
          track(loading),
        ];
        if (values.every((item, index) => Object.is(item, previousValues.value[index]))) return;
        previousValues.value = values;
        const [list, busy] = values;
        onBusy$?.(list.length, busy);
      },
      { deferUpdates: false },
    );

    const previousValues_1 = useSignal<[typeof failure.value, typeof loading.value]>(() => [
      failure.value,
      loading.value,
    ]);
    useTask$(
      ({ track }) => {
        const values: [typeof failure.value, typeof loading.value] = [
          track(failure),
          track(loading),
        ];
        if (values.every((item, index) => Object.is(item, previousValues_1.value[index]))) return;
        previousValues_1.value = values;
        const [message, busy] = values;
        onFailed$?.(message, busy);
      },
      { deferUpdates: false },
    );

    const previousUnread = useSignal(() => unread.value);
    useTask$(
      ({ track }) => {
        const value = track(unread);
        if (Object.is(value, previousUnread.value)) return;
        previousUnread.value = value;
        onCounted$?.(value);
      },
      { deferUpdates: false },
    );

    const load = $(async () => {
      loading.value = true;
      failure.value = "";
      try {
        const list = await request();
        messages.value = list;
      } catch (error) {
        failure.value = error instanceof Error ? error.message : "unknown";
      }
      loading.value = false;
    });

    const refresh = $(async () => {
      loading.value = true;
      messages.value = await request();
      loading.value = false;
    });

    const markTwice = $(async () => {
      const bump = () => {
        unread.value += 1;
      };
      bump();
      bump();
      await nextTick();
      bump();
      bump();
    });

    return (
      <section class="inbox-lookup" aria-label="Inbox">
        <button type="button" onClick$={() => (sender.value = "Ann")}>
          Find Ann
        </button>
        <button type="button" onClick$={() => (sender.value = "Anna")}>
          Find Anna
        </button>
        <button type="button" onClick$={answerLookups}>
          Answer lookups
        </button>
        <ol aria-label="Answers">
          {answers.value.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ol>
        <button
          type="button"
          onClick$={() => (order.value = order.value === "newest" ? "oldest" : "newest")}
        >
          Switch order
        </button>
        <button type="button" onClick$={() => orderReply.value?.("ready")}>
          Answer order
        </button>
        <p>Order: {ordering.value}</p>
        <button type="button" onClick$={load}>
          Load
        </button>
        <button type="button" onClick$={refresh}>
          Refresh
        </button>
        <button type="button" onClick$={() => respond.value?.(["Hello", "Welcome"])}>
          Reply
        </button>
        <button type="button" onClick$={() => fail.value?.(new Error("offline"))}>
          Fail
        </button>
        <p role="status">
          {loading.value ? "Loading" : `${messages.value.length} messages`}
          {failure.value === "" ? "" : `, ${failure.value}`}
        </p>
        <button type="button" onClick$={markTwice}>
          Mark twice
        </button>
        <p>Unread: {unread.value}</p>
      </section>
    );
  },
);

/**
 * Resolves once Qwik has rendered the writes made before it: Qwik renders them in a microtask,
 * so they are in the DOM by the next task.
 */
function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}
