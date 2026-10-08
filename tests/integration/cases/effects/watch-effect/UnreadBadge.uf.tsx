import { defineEmits, ref, watchEffect } from "unframework";

export interface UnreadBadgeProps {
  appName: string;
}

export default function UnreadBadge({ appName }: UnreadBadgeProps) {
  const emit = defineEmits<{ titleChange: [title: string]; titleRelease: [title: string] }>();

  const unread = ref(0);

  watchEffect((onCleanup) => {
    const title = `(${unread.value}) ${appName}`;
    emit("titleChange", title);
    onCleanup(() => {
      emit("titleRelease", title);
    });
  });

  return (
    <section class="unread-badge" aria-label="Inbox">
      <p role="status">{unread.value} unread</p>
      <button type="button" onClick={() => unread.value++}>
        Receive a message
      </button>
      <button type="button" onClick={() => (unread.value = 0)}>
        Mark all read
      </button>
    </section>
  );
}
