import { useLayoutEffect, useRef, useState } from "react";

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

export default function DisplaySettings({ onApplied, onSaved }: DisplaySettingsEvents) {
  // React Compiler 1.0 cannot compile a default value it cannot reorder yet: the component opts out of it.
  "use no memo";

  const onSavedRef = useRef(onSaved);
  useLayoutEffect(() => {
    onSavedRef.current = onSaved;
  });

  const [settings, setSettings] = useState<Settings>({ theme: "light", size: 14 });
  const settingsRef = useRef(settings);
  const [maxSize, setMaxSize] = useState(20);
  const maxSizeRef = useRef(maxSize);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(saving);
  const [label, setLabel] = useState("Never saved");
  const labelRef = useRef(label);
  const [failure, setFailure] = useState("");
  const failureRef = useRef(failure);
  const finish = useRef<((reply: SaveReply) => void) | undefined>(undefined);

  function apply(patch: Partial<Settings>) {
    const { theme = settingsRef.current.theme, size = settingsRef.current.size } = patch;
    settingsRef.current = { theme, size };
    setSettings(settingsRef.current);
    onApplied?.(theme, size);
  }

  function grow() {
    const clamp = (value: number, max = maxSizeRef.current) => Math.min(value, max);
    apply({ size: clamp(settingsRef.current.size + 4) });
  }

  async function save() {
    savingRef.current = true;
    setSaving(savingRef.current);
    failureRef.current = "";
    setFailure(failureRef.current);
    try {
      const reply = await new Promise<SaveReply>((resolve) => {
        finish.current = resolve;
      });
      if (reply.error) throw new Error(reply.error);
      const id = reply.id ?? 0;
      labelRef.current = id === 0 ? "Saved as a draft" : `Saved as #${id}`;
      setLabel(labelRef.current);
      onSavedRef.current?.(id);
    } catch (error) {
      failureRef.current = error instanceof Error ? error.message : "Saving failed";
      setFailure(failureRef.current);
    } finally {
      savingRef.current = false;
      setSaving(savingRef.current);
    }
  }

  return (
    <section className="display-settings" aria-label="Display">
      <p role="status">
        Theme {settings.theme}, size {settings.size}
      </p>
      <button type="button" onClick={() => apply({ theme: "dark" })}>
        Dark
      </button>
      <button type="button" onClick={grow}>
        Larger
      </button>
      <button
        type="button"
        onClick={() => {
          maxSizeRef.current = 30;
          setMaxSize(maxSizeRef.current);
        }}
      >
        Allow up to 30
      </button>
      <button type="button" onClick={save}>
        Save
      </button>
      <p>{saving ? "Saving" : failure === "" ? label : `Failed: ${failure}`}</p>
      <div role="group" aria-label="Server">
        <button type="button" onClick={() => finish.current?.({ id: 7 })}>
          Reply with an id
        </button>
        <button type="button" onClick={() => finish.current?.({})}>
          Reply as a draft
        </button>
        <button type="button" onClick={() => finish.current?.({ error: "Disk full" })}>
          Reply with an error
        </button>
      </div>
    </section>
  );
}
