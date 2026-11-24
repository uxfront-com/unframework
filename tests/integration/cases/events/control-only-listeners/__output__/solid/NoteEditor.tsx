import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export interface NoteEditorEvents {
  onSaved?: (title: string, bold: boolean) => void;
}

export default function NoteEditor(
  props: NoteEditorEvents &
    Omit<ComponentProps<"form">, "style" | "onSubmit"> & {
      style?: JSX.CSSProperties;
      onSubmit?: Extract<ComponentProps<"form">["onSubmit"], (event: never) => void>;
    },
) {
  const [, others] = splitProps(props, ["onSaved", "class", "onSubmit"]);

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
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit?.(event);
      }}
      {...others}
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
