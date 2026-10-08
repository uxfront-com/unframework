import { createSignal } from "solid-js";

export interface Settings {
  theme: string;
  size: number;
}

interface SaveReply {
  id?: number;
  error?: string;
}

export interface DisplaySettingsEvents {
  onApplied?: (theme: string, size: number) => void;
  onSaved?: (id: number) => void;
}

export default function DisplaySettings(props: DisplaySettingsEvents) {
  const [settings, setSettings] = createSignal<Settings>({ theme: "light", size: 14 });
  const [maxSize, setMaxSize] = createSignal(20);
  const [saving, setSaving] = createSignal(false);
  const [label, setLabel] = createSignal("Never saved");
  const [failure, setFailure] = createSignal("");
  let finish: ((reply: SaveReply) => void) | undefined;

  function apply(patch: Partial<Settings>) {
    const { theme = settings().theme, size = settings().size } = patch;
    setSettings({ theme, size });
    props.onApplied?.(theme, size);
  }

  function grow() {
    const clamp = (value: number, max = maxSize()) => Math.min(value, max);
    apply({ size: clamp(settings().size + 4) });
  }

  async function save() {
    setSaving(true);
    setFailure("");
    try {
      const reply = await new Promise<SaveReply>((resolve) => {
        finish = resolve;
      });
      if (reply.error) throw new Error(reply.error);
      const id = reply.id ?? 0;
      setLabel(id === 0 ? "Saved as a draft" : `Saved as #${id}`);
      props.onSaved?.(id);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Saving failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section class="display-settings" aria-label="Display">
      <p role="status">
        Theme {settings().theme}, size {settings().size}
      </p>
      <button type="button" onClick={() => apply({ theme: "dark" })}>
        Dark
      </button>
      <button type="button" onClick={grow}>
        Larger
      </button>
      <button type="button" onClick={() => setMaxSize(30)}>
        Allow up to 30
      </button>
      <button type="button" onClick={save}>
        Save
      </button>
      <p>{saving() ? "Saving" : failure() === "" ? label() : `Failed: ${failure()}`}</p>
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
