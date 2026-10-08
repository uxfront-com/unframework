import { createSignal, onCleanup, onMount } from "solid-js";

export interface DraftEditorEvents {
  onSaved?: (count: number) => void;
}

export default function DraftEditor(props: DraftEditorEvents) {
  const [saves, setSaves] = createSignal(0);

  function onShortcut(event: KeyboardEvent) {
    if (event.key !== "s" || !event.ctrlKey) return;
    event.preventDefault();
    setSaves(saves() + 1);
    props.onSaved?.(saves());
  }

  onMount(() => {
    document.addEventListener("keydown", onShortcut);
  });

  onMount(() =>
    onCleanup(() => {
      document.removeEventListener("keydown", onShortcut);
    }),
  );

  return (
    <section class="draft-editor" aria-label="Draft">
      <label>
        Draft
        <textarea name="draft" />
      </label>
      <p role="status">Saved: {saves()}</p>
    </section>
  );
}
