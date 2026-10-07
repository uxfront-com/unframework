<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  type Props = { onliked?: (liked: boolean, by: string) => void };

  let { onliked }: Props = $props();

  let text = $state("");
  let liked = $state(false);

  function autosize(event: Event) {
    const area = event.currentTarget as HTMLTextAreaElement;
    text = area.value;
    area.style.height = `${Math.max(area.value.split("\n").length, 2) * 1.5}em`;
  }

  function toggleLike(event: MouseEvent | KeyboardEvent) {
    liked = !liked;
    onliked?.(liked, event.type);
  }

  function onLikeKeydown(event: KeyboardEvent) {
    if (event.key === " ") event.preventDefault();
    if (event.key === "Enter" || event.key === " ") toggleLike(event);
  }
</script>

<section class="comment-card" aria-label="Comment">
  <label>Comment<textarea name="comment" rows="2" oninput={autosize}></textarea></label
  ><div class="meter" role="presentation">
    <div class="fill" style:width={`${Math.min(text.length, 100)}%`}></div>
  </div
  ><p>{text.length} characters</p
  ><div
    class="like"
    role="button"
    tabindex="0"
    aria-pressed={liked}
    onclick={toggleLike}
    onkeydown={onLikeKeydown}
  >Like</div>
</section>
