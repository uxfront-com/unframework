import { $, type QRL, component$, useConstant, useSignal, useVisibleTask$ } from "@qwik.dev/core";

export interface DraftEditorEvents {
  onSaved$?: QRL<(count: number) => void>;
}

export default component$<DraftEditorEvents>(({ onSaved$ }) => {
  const saves = useSignal(0);

  const onShortcut = useConstant(() =>
    $((event: KeyboardEvent) => {
      if (event.key !== "s" || !event.ctrlKey) return;
      event.preventDefault();
      saves.value += 1;
      onSaved$?.(saves.value);
    }),
  );

  useVisibleTask$(
    () => {
      document.addEventListener("keydown", onShortcut);
    },
    { strategy: "document-ready" },
  );

  useVisibleTask$(
    ({ cleanup }) => {
      cleanup(() => {
        document.removeEventListener("keydown", onShortcut);
      });
    },
    { strategy: "document-ready" },
  );

  return (
    <section class="draft-editor" aria-label="Draft">
      <label>
        Draft
        <textarea name="draft" />
      </label>
      <p role="status">Saved: {saves.value}</p>
    </section>
  );
});
