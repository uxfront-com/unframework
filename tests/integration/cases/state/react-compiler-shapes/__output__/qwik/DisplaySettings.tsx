import { $, type QRL, component$, useSignal } from "@qwik.dev/core";

export interface Settings {
  theme: string;
  size: number;
}

interface SaveReply {
  id?: number;
  error?: string;
}

export interface DisplaySettingsEvents {
  onApplied$?: QRL<(theme: string, size: number) => void>;
  onSaved$?: QRL<(id: number) => void>;
}

export default component$<DisplaySettingsEvents>(({ onApplied$, onSaved$ }) => {
  const settings = useSignal<Settings>({ theme: "light", size: 14 });
  const maxSize = useSignal(20);
  const saving = useSignal(false);
  const label = useSignal("Never saved");
  const failure = useSignal("");
  const finish = useSignal<((reply: SaveReply) => void) | undefined>();

  const apply = $((patch: Partial<Settings>) => {
    const { theme = settings.value.theme, size = settings.value.size } = patch;
    settings.value = { theme, size };
    onApplied$?.(theme, size);
  });

  const grow = $(async () => {
    const clamp = (value: number, max = maxSize.value) => Math.min(value, max);
    await apply({ size: clamp(settings.value.size + 4) });
  });

  const save = $(async () => {
    saving.value = true;
    failure.value = "";
    try {
      const reply = await new Promise<SaveReply>((resolve) => {
        finish.value = resolve;
      });
      if (reply.error) throw new Error(reply.error);
      const id = reply.id ?? 0;
      label.value = id === 0 ? "Saved as a draft" : `Saved as #${id}`;
      onSaved$?.(id);
    } catch (error) {
      failure.value = error instanceof Error ? error.message : "Saving failed";
    } finally {
      saving.value = false;
    }
  });

  return (
    <section class="display-settings" aria-label="Display">
      <p role="status">
        Theme {settings.value.theme}, size {settings.value.size}
      </p>
      <button type="button" onClick$={() => apply({ theme: "dark" })}>
        Dark
      </button>
      <button type="button" onClick$={grow}>
        Larger
      </button>
      <button type="button" onClick$={() => (maxSize.value = 30)}>
        Allow up to 30
      </button>
      <button type="button" onClick$={save}>
        Save
      </button>
      <p>
        {saving.value ? "Saving" : failure.value === "" ? label.value : `Failed: ${failure.value}`}
      </p>
      <div role="group" aria-label="Server">
        <button type="button" onClick$={() => finish.value?.({ id: 7 })}>
          Reply with an id
        </button>
        <button type="button" onClick$={() => finish.value?.({})}>
          Reply as a draft
        </button>
        <button type="button" onClick$={() => finish.value?.({ error: "Disk full" })}>
          Reply with an error
        </button>
      </div>
    </section>
  );
});
