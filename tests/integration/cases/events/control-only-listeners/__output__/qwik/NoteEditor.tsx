import { $, type QRL, component$, sync$, useSignal } from "@qwik.dev/core";

export interface NoteEditorEvents {
  onSaved$?: QRL<(title: string, bold: boolean) => void>;
}

export default component$<NoteEditorEvents>(({ onSaved$ }) => {
  const title = useSignal("");
  const bold = useSignal(false);
  const saves = useSignal(0);

  const save = $(() => {
    saves.value += 1;
    onSaved$?.(title.value, bold.value);
  });

  return (
    <form
      class="note-editor"
      aria-label="Note"
      preventdefault:submit
      onSubmit$={sync$((event: SubmitEvent) => {
        event.preventDefault();
      })}
    >
      <label>
        Title
        <input
          name="title"
          onInput$={(_, element) => (title.value = (element as HTMLInputElement).value)}
        />
      </label>
      <label>
        Text
        <textarea name="text" />
      </label>
      <div class="format" role="group" aria-label="Format">
        <button
          type="button"
          aria-pressed={bold.value}
          preventdefault:mousedown
          onMouseDown$={sync$((event: MouseEvent) => {
            event.preventDefault();
          })}
          onClick$={() => (bold.value = !bold.value)}
        >
          Bold
        </button>
      </div>
      <button type="submit" onClick$={save}>
        Save
      </button>
      <p role="status">Saves: {saves.value}</p>
    </form>
  );
});
