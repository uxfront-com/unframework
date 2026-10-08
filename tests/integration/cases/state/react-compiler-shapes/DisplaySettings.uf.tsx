import { defineEmits, ref } from "unframework";

export interface Settings {
  theme: string;
  size: number;
}

interface SaveReply {
  id?: number;
  error?: string;
}

export default function DisplaySettings() {
  const emit = defineEmits<{
    applied: [theme: string, size: number];
    saved: [id: number];
  }>();

  const settings = ref<Settings>({ theme: "light", size: 14 });
  const maxSize = ref(20);
  const saving = ref(false);
  const label = ref("Never saved");
  const failure = ref("");
  let finish: ((reply: SaveReply) => void) | undefined;

  function apply(patch: Partial<Settings>) {
    const { theme = settings.value.theme, size = settings.value.size } = patch;
    settings.value = { theme, size };
    emit("applied", theme, size);
  }

  function grow() {
    const clamp = (value: number, max = maxSize.value) => Math.min(value, max);
    apply({ size: clamp(settings.value.size + 4) });
  }

  async function save() {
    saving.value = true;
    failure.value = "";
    try {
      const reply = await new Promise<SaveReply>((resolve) => {
        finish = resolve;
      });
      if (reply.error) throw new Error(reply.error);
      const id = reply.id ?? 0;
      label.value = id === 0 ? "Saved as a draft" : `Saved as #${id}`;
      emit("saved", id);
    } catch (error) {
      failure.value = error instanceof Error ? error.message : "Saving failed";
    } finally {
      saving.value = false;
    }
  }

  return (
    <section class="display-settings" aria-label="Display">
      <p role="status">
        Theme {settings.value.theme}, size {settings.value.size}
      </p>
      <button type="button" onClick={() => apply({ theme: "dark" })}>
        Dark
      </button>
      <button type="button" onClick={grow}>
        Larger
      </button>
      <button type="button" onClick={() => (maxSize.value = 30)}>
        Allow up to 30
      </button>
      <button type="button" onClick={save}>
        Save
      </button>
      <p>
        {saving.value ? "Saving" : failure.value === "" ? label.value : `Failed: ${failure.value}`}
      </p>
      <div role="group" aria-label="Server">
        <button type="button" onClick={() => finish?.({ id: 7 })}>
          Reply with an id
        </button>
        <button type="button" onClick={() => finish?.({})}>
          Reply as a draft
        </button>
        <button type="button" onClick={() => finish?.({ error: "Disk full" })}>
          Reply with an error
        </button>
      </div>
    </section>
  );
}
