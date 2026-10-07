import {
  type InputEvent,
  type KeyboardEvent,
  type MouseEvent,
  type SubmitEvent,
  useRef,
  useState,
} from "react";

export interface TagFormEvents {
  onTagsChange?: (tags: string[]) => void;
}

function blockComma(event: KeyboardEvent) {
  if (event.key === ",") event.preventDefault();
}

export default function TagForm({ onTagsChange }: TagFormEvents) {
  const [tags, setTags] = useState<string[]>([]);
  const tagsRef = useRef(tags);
  const [draft, setDraft] = useState("");
  const draftRef = useRef(draft);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpOpenRef = useRef(helpOpen);
  const field = useRef<HTMLInputElement>(null);

  function updateDraft(event: InputEvent) {
    draftRef.current = (event.currentTarget as HTMLInputElement).value;
    setDraft(draftRef.current);
  }

  function addTag(event: SubmitEvent) {
    event.preventDefault();
    if (draftRef.current !== "" && !tagsRef.current.includes(draftRef.current)) {
      tagsRef.current = [...tagsRef.current, draftRef.current];
      setTags(tagsRef.current);
      onTagsChange?.(tagsRef.current);
    }
    draftRef.current = "";
    setDraft(draftRef.current);
    const input = field.current;
    if (input) input.value = "";
  }

  function toggleHelp(event: MouseEvent) {
    event.preventDefault();
    helpOpenRef.current = !helpOpenRef.current;
    setHelpOpen(helpOpenRef.current);
  }

  return (
    <form className="tag-form" aria-label="Tags" onSubmit={addTag}>
      <label>
        New tag
        <input name="tag" ref={field} onKeyDown={blockComma} onInput={updateDraft} />
      </label>
      <button type="submit">Add tag</button>
      <a href="/help/tags" onClick={toggleHelp}>
        How tags work
      </a>
      {helpOpen ? <p>A tag is one word: commas are not allowed.</p> : null}
      <ul aria-label="Added tags">
        {tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
    </form>
  );
}
