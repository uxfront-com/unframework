import {
  type ComponentProps,
  For,
  type JSX,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  splitProps,
  untrack,
} from "solid-js";

export interface TagFormEvents {
  onTagsChange?: (tags: string[]) => void;
}

function blockComma(event: KeyboardEvent) {
  if (event.key === ",") event.preventDefault();
}

export default function TagForm(
  props: TagFormEvents &
    Omit<ComponentProps<"form">, "style" | "onSubmit"> & {
      style?: JSX.CSSProperties;
      onSubmit?: Extract<ComponentProps<"form">["onSubmit"], (event: never) => void>;
    },
) {
  const [, others] = splitProps(props, ["onTagsChange", "class", "onSubmit"]);

  const [tags, setTags] = createSignal<string[]>([]);
  const [draft, setDraft] = createSignal("");
  const [helpOpen, setHelpOpen] = createSignal(false);
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
          ref={(element) => {
            field = element;
            onCleanup(() => {
              field = null;
            });
          }}
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

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
  );
}
