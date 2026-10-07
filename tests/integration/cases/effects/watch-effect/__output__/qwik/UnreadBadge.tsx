import {
  type QRL,
  component$,
  noSerialize,
  useConstant,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface UnreadBadgeProps {
  appName: string;
}

export interface UnreadBadgeEvents {
  onTitleChange$?: QRL<(title: string) => void>;
  onTitleRelease$?: QRL<(title: string) => void>;
}

export default component$<UnreadBadgeProps & UnreadBadgeEvents>(
  ({ appName, onTitleChange$, onTitleRelease$ }) => {
    const unread = useSignal(0);

    const previousEffect = useSignal<[typeof unread.value, typeof appName]>();
    const effectCleanups = useConstant(() => noSerialize<(() => void)[]>([]));
    useVisibleTask$(
      ({ track }) => {
        const values: [typeof unread.value, typeof appName] = [track(unread), track(() => appName)];
        const last = previousEffect.value;
        if (last && values.every((item, index) => Object.is(item, last[index]))) return;
        previousEffect.value = values;
        for (const callback of effectCleanups?.splice(0) ?? []) callback();
        const onCleanup = (callback: () => void) => void effectCleanups?.push(callback);
        const title = `(${unread.value}) ${appName}`;
        onTitleChange$?.(title);
        onCleanup(() => {
          onTitleRelease$?.(title);
        });
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

    return (
      <section class="unread-badge" aria-label="Inbox">
        <p role="status">{unread.value} unread</p>
        <button type="button" onClick$={() => unread.value++}>
          Receive a message
        </button>
        <button type="button" onClick$={() => (unread.value = 0)}>
          Mark all read
        </button>
      </section>
    );
  },
);
