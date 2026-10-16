import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useConstant,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface DraftEditorEvents {
  onSaved$?: QRL<(count: number) => void>;
}

export default component$<DraftEditorEvents & { class?: ClassList; style?: CSSProperties }>(
  ({ onSaved$, class: className, style }) => {
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
      <section class={["draft-editor", className]} aria-label="Draft" style={style}>
        <label>
          Draft
          <textarea name="draft" />
        </label>
        <p role="status">Saved: {saves.value}</p>
      </section>
    );
  },
);
