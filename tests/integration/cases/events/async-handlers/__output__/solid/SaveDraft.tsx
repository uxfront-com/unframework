import { createSignal } from "solid-js";

export interface SaveDraftEvents {
  onSaved?: (attempt: number, status: string) => void;
}

export default function SaveDraft(props: SaveDraftEvents) {
  const [status, setStatus] = createSignal("Not saved");
  const [attempts, setAttempts] = createSignal(0);

  async function save() {
    setStatus("Saving");
    setAttempts(attempts() + 1);
    await Promise.resolve();
    setStatus("Checking");
    await nextTick();
    setStatus(`Saved, attempt ${attempts()}`);
    props.onSaved?.(attempts(), status());
  }

  return (
    <section class="save-draft" aria-label="Draft">
      <p role="status">{status()}</p>
      <button type="button" onClick={save}>
        Save the draft
      </button>
    </section>
  );
}

/**
 * Resolves once the DOM has updated and the watchers have run: Solid applies writes as it makes
 * them, and the watchers run in a microtask queued at the first write, before this one.
 */
function nextTick(): Promise<void> {
  return Promise.resolve();
}
