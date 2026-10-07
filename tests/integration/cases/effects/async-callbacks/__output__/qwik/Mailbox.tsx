import { $, type QRL, component$, useSignal, useTask$, useVisibleTask$ } from "@qwik.dev/core";

export interface MailboxProps {
  folder: string;
}

export interface MailboxEvents {
  onLoaded$?: QRL<(name: string, unread: number) => void>;
  onProgress$?: QRL<(status: string, attempts: number) => void>;
  onSeen$?: QRL<(text: string) => void>;
  onNoted$?: QRL<(text: string) => void>;
}

export default component$<MailboxProps & MailboxEvents>(
  ({ folder, onLoaded$, onProgress$, onSeen$, onNoted$ }) => {
    const name = useSignal("Loading");
    const unread = useSignal(0);
    const status = useSignal("idle");
    const attempts = useSignal(0);
    const summary = useSignal("No messages");
    const timer = useSignal<ReturnType<typeof setInterval> | undefined>();

    const previousValues = useSignal<[typeof name.value, typeof unread.value]>(() => [
      name.value,
      unread.value,
    ]);
    useTask$(
      ({ track }) => {
        const values: [typeof name.value, typeof unread.value] = [track(name), track(unread)];
        if (values.every((item, index) => Object.is(item, previousValues.value[index]))) return;
        previousValues.value = values;
        const [nextName, nextUnread] = values;
        onLoaded$?.(nextName, nextUnread);
      },
      { deferUpdates: false },
    );

    const previousValues_1 = useSignal<[typeof status.value, typeof attempts.value]>(() => [
      status.value,
      attempts.value,
    ]);
    useTask$(
      ({ track }) => {
        const values: [typeof status.value, typeof attempts.value] = [
          track(status),
          track(attempts),
        ];
        if (values.every((item, index) => Object.is(item, previousValues_1.value[index]))) return;
        previousValues_1.value = values;
        const [nextStatus, nextAttempts] = values;
        onProgress$?.(nextStatus, nextAttempts);
      },
      { deferUpdates: false },
    );

    const previousUnread = useSignal(() => unread.value);
    useTask$(
      ({ track }) => {
        const value = track(unread);
        if (Object.is(value, previousUnread.value)) return;
        previousUnread.value = value;
        void (async () => {
          const text = await Promise.resolve(`${value} unread`);
          summary.value = text;
        })();
      },
      { deferUpdates: false },
    );

    const previousEffect = useSignal<[typeof status.value, typeof attempts.value]>();
    useVisibleTask$(
      ({ track }) => {
        const values: [typeof status.value, typeof attempts.value] = [
          track(status),
          track(attempts),
        ];
        const last = previousEffect.value;
        if (last && values.every((item, index) => Object.is(item, last[index]))) return;
        previousEffect.value = values;
        void (async () => {
          const text = `${status.value} after ${attempts.value}`;
          await Promise.resolve();
          onSeen$?.(text);
        })();
      },
      { strategy: "document-ready" },
    );

    useVisibleTask$(
      async () => {
        await Promise.resolve();
        name.value = folder;
        unread.value = 3;
      },
      { strategy: "document-ready" },
    );

    const save = $(async () => {
      const label = name.value.trim();
      status.value = `saving ${label}`;
      attempts.value += 1;
      await nextTick();
      status.value = "saved";
    });

    const refreshEverySecond = $(() => {
      clearInterval(timer.value);
      timer.value = setInterval(() => {
        name.value = `${folder} (refreshed)`;
        unread.value += 1;
      }, 1000);
    });

    const markAllRead = $(() => {
      queueMicrotask(() => {
        unread.value = 0;
        name.value = `${folder}, all read`;
      });
    });

    const note = $(() => {
      void Promise.resolve().then(() => {
        onNoted$?.(`${name.value}: ${unread.value}`);
      });
    });

    useVisibleTask$(
      ({ cleanup }) => {
        cleanup(() => {
          clearInterval(timer.value);
        });
      },
      { strategy: "document-ready" },
    );

    return (
      <section class="mailbox" aria-label="Mailbox">
        <h2>{name.value}</h2>
        <p role="status">{summary.value}</p>
        <p>Status: {status.value}</p>
        <button type="button" onClick$={save}>
          Save
        </button>
        <button type="button" onClick$={refreshEverySecond}>
          Refresh every second
        </button>
        <button type="button" onClick$={markAllRead}>
          Mark all read
        </button>
        <button type="button" onClick$={note}>
          Note
        </button>
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
