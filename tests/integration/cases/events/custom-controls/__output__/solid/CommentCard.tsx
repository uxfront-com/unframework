import { createSignal } from "solid-js";

export interface CommentCardEvents {
  onLiked?: (liked: boolean, by: string) => void;
}

export default function CommentCard(props: CommentCardEvents) {
  const [text, setText] = createSignal("");
  const [liked, setLiked] = createSignal(false);

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
    <section class="comment-card" aria-label="Comment">
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
        aria-pressed={liked()}
        onClick={toggleLike}
        onKeyDown={onLikeKeydown}
      >
        Like
      </div>
    </section>
  );
}
