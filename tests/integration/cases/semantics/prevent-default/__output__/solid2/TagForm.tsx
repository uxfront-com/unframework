import { KeyedFor } from "./_unframework/KeyedFor";
import { clearedRef } from "./_unframework/clearedRef";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

export interface TagFormEvents {
  onTagsChange?: (tags: string[]) => void;
}

function blockComma(event: KeyboardEvent) {
  if (event.key === ",") event.preventDefault();
}

export default function TagForm(
  props: TagFormEvents &
    Omit<ComponentProps<"form">, "class" | "style" | "onSubmit"> & {
      class?: string;
      style?: JSX.CSSProperties;
      onSubmit?: Extract<ComponentProps<"form">["onSubmit"], (event: never) => void>;
    },
) {
  const others = omit(props, "onTagsChange", "class", "onSubmit");

  const [tags, setTags] = createState<string[]>([]);
  const [draft, setDraft] = createState("");
  const [helpOpen, setHelpOpen] = createState(false);
  let field: HTMLInputElement | null = null;

  function updateDraft(event: InputEvent) {
    setDraft((event.currentTarget as HTMLInputElement).value);
  }

  function addTag(event: SubmitEvent) {
    event.preventDefault();
    if (draft() !== "" && !tags().includes(draft())) {
      setTags([...tags(), draft()]);
      props.onTagsChange?.(tags());
    }
    setDraft("");
    const input = field;
    if (input) input.value = "";
  }

  function toggleHelp(event: MouseEvent) {
    event.preventDefault();
    setHelpOpen(!helpOpen());
  }

  return (
    <form
      class={props.class ? `tag-form ${props.class}` : "tag-form"}
      aria-label="Tags"
      onSubmit={(event) => {
        addTag(event);
        props.onSubmit?.(event);
      }}
      {...others}
    >
      <label>
        New tag
        <input
          name="tag"
          ref={clearedRef(
            (element) => {
              field = element;
            },
            () => {
              field = null;
            },
          )}
          onKeyDown={blockComma}
          onInput={updateDraft}
        />
      </label>
      <button type="submit">Add tag</button>
      <a href="/help/tags" onClick={toggleHelp}>
        How tags work
      </a>
      <Show when={helpOpen()}>
        <p>A tag is one word: commas are not allowed.</p>
      </Show>
      <ul aria-label="Added tags">
        <KeyedFor each={tags()} by={(tag) => tag}>
          {(tag) => <li>{tag.value}</li>}
        </KeyedFor>
      </ul>
    </form>
  );
}
