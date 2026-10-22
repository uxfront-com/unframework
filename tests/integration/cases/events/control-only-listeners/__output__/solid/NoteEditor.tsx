import { type JSX, createSignal } from "solid-js";

export interface NoteEditorEvents {
  onSaved?: (title: string, bold: boolean) => void;
}

export default function NoteEditor(
  props: NoteEditorEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [title, setTitle] = createSignal("");
  const [bold, setBold] = createSignal(false);
  const [saves, setSaves] = createSignal(0);

  function save() {
    setSaves(saves() + 1);
    props.onSaved?.(title(), bold());
  }

  return (
    <form
      class={props.class ? `note-editor ${props.class}` : "note-editor"}
      aria-label="Note"
      onSubmit={(event) => event.preventDefault()}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <label>
        Title
        <input
          name="title"
          onInput={(event) => setTitle((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <label>
        Text
        <textarea name="text" />
      </label>
      <div class="format" role="group" aria-label="Format">
        <button
          type="button"
          aria-pressed={bold()}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setBold(!bold())}
        >
          Bold
        </button>
      </div>
      <button type="submit" onClick={save}>
        Save
      </button>
      <p role="status">Saves: {saves()}</p>
    </form>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
