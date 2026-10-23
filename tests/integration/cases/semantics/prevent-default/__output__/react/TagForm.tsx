import {
  type CSSProperties,
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

export interface TagFormAttributes {
  className?: string;
  style?: CSSProperties;
}

function blockComma(event: KeyboardEvent) {
  if (event.key === ",") event.preventDefault();
}

export default function TagForm({
  onTagsChange,
  className,
  style,
  ...attributes
}: TagFormEvents & TagFormAttributes) {
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
    <form
      className={cx("tag-form", className)}
      aria-label="Tags"
      onSubmit={addTag}
      style={style}
      {...scopeAttributes(attributes)}
    >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
