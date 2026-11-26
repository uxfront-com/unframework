import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface NoteEditorEvents {
  onSaved?: (title: string, bold: boolean) => void;
}

export default function NoteEditor(
  props: NoteEditorEvents &
    Omit<ComponentProps<"form">, "class" | "style" | "onSubmit"> & {
      class?: string;
      style?: JSX.CSSProperties;
      onSubmit?: Extract<ComponentProps<"form">["onSubmit"], (event: never) => void>;
    },
) {
  const others = omit(props, "onSaved", "class", "onSubmit");

  const [title, setTitle] = createState("");
  const [bold, setBold] = createState(false);
  const [saves, setSaves] = createState(0);

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
          aria-pressed={enumeratedValue(bold())}
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
