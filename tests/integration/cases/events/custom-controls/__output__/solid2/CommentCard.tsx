import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

export interface CommentCardEvents {
  onLiked?: (liked: boolean, by: string) => void;
}

export default function CommentCard(
  props: CommentCardEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onLiked", "class");

  const [text, setText] = createState("");
  const [liked, setLiked] = createState(false);

  function autosize(event: Event) {
    const area = event.currentTarget as HTMLTextAreaElement;
    setText(area.value);
    area.style.height = `${Math.max(area.value.split("\n").length, 2) * 1.5}em`;
  }

  function toggleLike(event: MouseEvent | KeyboardEvent) {
    setLiked(!liked());
    props.onLiked?.(liked(), event.type);
  }

  function onLikeKeydown(event: KeyboardEvent) {
    if (event.key === " ") event.preventDefault();
    if (event.key === "Enter" || event.key === " ") toggleLike(event);
  }

  return (
    <section
      class={props.class ? `comment-card ${props.class}` : "comment-card"}
      aria-label="Comment"
      {...others}
    >
      <label>
        Comment
        <textarea name="comment" rows="2" onInput={autosize} />
      </label>
      <div class="meter" role="presentation">
        <div class="fill" style={{ width: `${Math.min(text().length, 100)}%` }} />
      </div>
      <p>{text().length} characters</p>
      <div
        class="like"
        role="button"
        tabindex="0"
        aria-pressed={enumeratedValue(liked())}
        onClick={toggleLike}
        onKeyDown={onLikeKeydown}
      >
        Like
      </div>
    </section>
  );
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
}

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
