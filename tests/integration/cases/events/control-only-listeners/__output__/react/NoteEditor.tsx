import { type CSSProperties, useRef, useState } from "react";

export interface NoteEditorEvents {
  onSaved?: (title: string, bold: boolean) => void;
}

export interface NoteEditorAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function NoteEditor({
  onSaved,
  className,
  style,
}: NoteEditorEvents & NoteEditorAttributes) {
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
    <form
      className={cx("note-editor", className)}
      aria-label="Note"
      onSubmit={(event) => event.preventDefault()}
      style={style}
    >
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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
