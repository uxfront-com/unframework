// UF2024 unsafe-local-call: `markRead` writes state and is called inside a `forEach` callback;
// Qwik's output calls a local function as a QRL, asynchronously, which a callback cannot await.
// Call it directly in the handler's body, or write the state once.
import { ref } from "unframework";

export interface InboxProps {
  initial: string[];
}

export default function Inbox({ initial }: InboxProps) {
  const unread = ref(initial);

  function markRead(subject: string) {
    unread.value = unread.value.filter((other) => other !== subject);
  }

  function markAllRead() {
    unread.value.forEach((subject) => markRead(subject));
  }

  return (
    <section class="inbox" aria-label="Inbox">
      <p role="status">{unread.value.length} unread</p>
      <button type="button" onClick={markAllRead}>
        Mark all read
      </button>
    </section>
  );
}
