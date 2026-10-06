<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface CommentQuoteProps {
    author: string;
    comment: string;
  }

  let { author, comment }: CommentQuoteProps = $props();
</script>

<figure class="comment-quote">
  <blockquote style="margin: 0; padding: 0">
    <p dir="auto">{comment}</p>
  </blockquote
  ><figcaption>{author}</figcaption>
</figure>
