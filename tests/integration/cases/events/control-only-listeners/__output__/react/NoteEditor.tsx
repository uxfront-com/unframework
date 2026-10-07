import { useRef, useState } from "react";

export interface NoteEditorEvents {
  onSaved?: (title: string, bold: boolean) => void;
}

export default function NoteEditor({ onSaved }: NoteEditorEvents) {
  const [title, setTitle] = useState("");
  const titleRef = useRef(title);
  const [bold, setBold] = useState(false);
  const boldRef = useRef(bold);
  const [saves, setSaves] = useState(0);
  const savesRef = useRef(saves);

  function save() {
    savesRef.current += 1;
    setSaves(savesRef.current);
    onSaved?.(titleRef.current, boldRef.current);
  }

  return (
    <form className="note-editor" aria-label="Note" onSubmit={(event) => event.preventDefault()}>
      <label>
        Title
        <input
          name="title"
          onInput={(event) => {
            titleRef.current = (event.currentTarget as HTMLInputElement).value;
            setTitle(titleRef.current);
          }}
        />
      </label>
      <label>
        Text
        <textarea name="text" />
      </label>
      <div className="format" role="group" aria-label="Format">
        <button
          type="button"
          aria-pressed={bold}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            boldRef.current = !boldRef.current;
            setBold(boldRef.current);
          }}
        >
          Bold
        </button>
      </div>
      <button type="submit" onClick={save}>
        Save
      </button>
      <p role="status">Saves: {saves}</p>
    </form>
  );
}
