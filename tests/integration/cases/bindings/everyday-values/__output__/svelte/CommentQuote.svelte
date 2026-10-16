<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface CommentQuoteProps {
    author: string;
    comment: string;
  }

  type Props = CommentQuoteProps & { class?: ClassValue; style?: string };

  let { author, comment, class: className, style }: Props = $props();
</script>

<figure class={["comment-quote", className]} {style}>
  <blockquote style="margin: 0; padding: 0">
    <p dir="auto">{comment}</p>
  </blockquote
  ><figcaption>{author}</figcaption>
</figure>
