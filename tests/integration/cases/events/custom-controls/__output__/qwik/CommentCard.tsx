import { $, type QRL, component$, sync$, useSignal } from "@qwik.dev/core";

export interface CommentCardEvents {
  onLiked$?: QRL<(liked: boolean, by: string) => void>;
}

export default component$<CommentCardEvents>(({ onLiked$ }) => {
  const text = useSignal("");
  const liked = useSignal(false);

  const autosize = $((event: Event, element: Element) => {
    const area = element as HTMLTextAreaElement;
    text.value = area.value;
    area.style.height = `${Math.max(area.value.split("\n").length, 2) * 1.5}em`;
  });

  const toggleLike = $((event: MouseEvent | KeyboardEvent) => {
    liked.value = !liked.value;
    onLiked$?.(liked.value, event.type);
  });

  const onLikeKeydown = $(async (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") await toggleLike(event);
  });

  return (
    <section class="comment-card" aria-label="Comment">
      <label>
        Comment
        <textarea name="comment" rows={2} onInput$={autosize} />
      </label>
      <div class="meter" role="presentation">
        <div class="fill" style={{ width: `${Math.min(text.value.length, 100)}%` }} />
      </div>
      <p>{text.value.length} characters</p>
      <div
        class="like"
        role="button"
        tabIndex={0}
        aria-pressed={liked.value}
        onClick$={toggleLike}
        onKeyDown$={[
          sync$((event: KeyboardEvent) => {
            if (event.key === " ") event.preventDefault();
          }),
          onLikeKeydown,
        ]}
      >
        Like
      </div>
    </section>
  );
});
