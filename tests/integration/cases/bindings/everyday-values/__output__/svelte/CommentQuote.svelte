<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface CommentQuoteProps {
    author: string;
    comment: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["figure"],
    "author" | "comment" | "children" | "class" | "style" | "ref"
  > &
    CommentQuoteProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["figure"] | null;
    };

  let {
    author,
    comment,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<figure class={["comment-quote", className]} {style} bind:this={ref} {...attributes}>
  <blockquote style="margin: 0; padding: 0">
    <p dir="auto">{comment}</p>
  </blockquote
  ><figcaption>{author}</figcaption>
</figure>
