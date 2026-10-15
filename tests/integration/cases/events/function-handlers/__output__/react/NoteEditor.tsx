import { type CSSProperties, type KeyboardEvent, type UIEvent, useRef, useState } from "react";

export interface NoteEditorEvents {
  onSaved?: (count: number) => void;
  onTagged?: (tag: string, via: string) => void;
}

export interface NoteEditorAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function NoteEditor({
  onSaved,
  onTagged,
  className,
  style,
}: NoteEditorEvents & NoteEditorAttributes) {
  const [saves, setSaves] = useState(0);
  const savesRef = useRef(saves);
  const [lastKey, setLastKey] = useState("none");
  const lastKeyRef = useRef(lastKey);
  const [tags, setTags] = useState<string[]>([]);
  const tagsRef = useRef(tags);
  const [tag, setTag] = useState("");
  const tagRef = useRef(tag);
  const tagField = useRef<HTMLInputElement>(null);

  function save() {
    savesRef.current += 1;
    setSaves(savesRef.current);
    onSaved?.(savesRef.current);
  }

  function recordKey(event: KeyboardEvent) {
    lastKeyRef.current = event.key;
    setLastKey(lastKeyRef.current);
  }

  function addTag(event: UIEvent) {
    if (tagRef.current === "") return;
    tagsRef.current = [...tagsRef.current, tagRef.current];
    setTags(tagsRef.current);
    onTagged?.(tagRef.current, event.type);
    tagRef.current = "";
    setTag(tagRef.current);
    if (tagField.current) tagField.current.value = "";
  }

  function onTagKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") addTag(event);
  }

  return (
    <section className={cx("note-editor", className)} aria-label="Note" style={style}>
      <button type="button" onClick={save}>
        Save
      </button>
      <label>
        Title
        <input name="title" onKeyDown={recordKey} />
      </label>
      <label>
        Body
        <textarea name="body" onKeyDown={recordKey} />
      </label>
      <p role="status">
        Saved {saves} times, last key {lastKey}
      </p>
      <button type="button" onClick={save}>
        Save and close
      </button>
      <label>
        Tag
        <input
          ref={tagField}
          name="tag"
          onInput={(event) => {
            tagRef.current = (event.currentTarget as HTMLInputElement).value;
            setTag(tagRef.current);
          }}
          onKeyDown={onTagKeydown}
        />
      </label>
      <button type="button" onClick={addTag}>
        Add tag
      </button>
      <p>Tags: {tags.join(", ")}</p>
    </section>
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
