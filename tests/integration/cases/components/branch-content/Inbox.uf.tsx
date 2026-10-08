import { ref } from "unframework";

import Notice from "./Notice.uf.tsx";

export default function Inbox({ unread }: { unread: number }) {
  const count = ref(unread);
  return (
    <div class="inbox">
      {count.value > 0 ? (
        <Notice text={`${count.value} unread`} tone="info" />
      ) : (
        <Notice text="All read" tone="quiet" />
      )}
      <button type="button" onClick={() => (count.value = 0)}>
        Mark all read
      </button>
    </div>
  );
}
