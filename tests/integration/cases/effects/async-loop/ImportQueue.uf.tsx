import { defineEmits, nextTick, ref, watch } from "unframework";

export interface ImportQueueProps {
  files: string[];
}

export default function ImportQueue({ files }: ImportQueueProps) {
  const emit = defineEmits<{ progress: [status: string, attempts: number] }>();

  const status = ref("idle");
  const attempts = ref(0);

  watch([status, attempts], ([nextStatus, nextAttempts]) => {
    emit("progress", nextStatus, nextAttempts);
  });

  async function importAll() {
    status.value = "starting";
    for (const file of files) {
      attempts.value += 1;
      await nextTick();
      status.value = `imported ${file}`;
    }
    status.value = "done";
  }

  return (
    <section class="import-queue" aria-label="Import">
      <button type="button" onClick={importAll}>
        Import all
      </button>
      <p role="status">
        {status.value}, {attempts.value} attempts
      </p>
    </section>
  );
}
