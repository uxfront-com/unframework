import { defineEmits, nextTick, ref } from "unframework";

export default function SaveDraft() {
  const emit = defineEmits<{ saved: [attempt: number, status: string] }>();

  const status = ref("Not saved");
  const attempts = ref(0);

  async function save() {
    status.value = "Saving";
    attempts.value += 1;
    await Promise.resolve();
    status.value = "Checking";
    await nextTick();
    status.value = `Saved, attempt ${attempts.value}`;
    emit("saved", attempts.value, status.value);
  }

  return (
    <section class="save-draft" aria-label="Draft">
      <p role="status">{status.value}</p>
      <button type="button" onClick={save}>
        Save the draft
      </button>
    </section>
  );
}
