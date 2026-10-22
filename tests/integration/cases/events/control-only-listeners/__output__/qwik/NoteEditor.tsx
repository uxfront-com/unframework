import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  sync$,
  useSignal,
} from "@qwik.dev/core";

export interface NoteEditorEvents {
  onSaved$?: QRL<(title: string, bold: boolean) => void>;
}

export default component$<NoteEditorEvents & { class?: ClassList; style?: CSSProperties }>(
  ({ onSaved$, class: className, style, ...attributes }) => {
    const title = useSignal("");
    const bold = useSignal(false);
    const saves = useSignal(0);

    const save = $(() => {
      saves.value += 1;
      onSaved$?.(title.value, bold.value);
    });

    return (
      <form
        class={["note-editor", className]}
        aria-label="Note"
        preventdefault:submit
        onSubmit$={sync$((event: SubmitEvent) => {
          event.preventDefault();
        })}
        {...scopeAttributes(attributes)}
        style={style}
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
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
