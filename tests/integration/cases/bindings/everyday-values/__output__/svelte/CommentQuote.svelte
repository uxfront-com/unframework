<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface CommentQuoteProps {
    author: string;
    comment: string;
  }

  type Props = CommentQuoteProps & { class?: ClassValue; style?: string };

  let { author, comment, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<figure class={["comment-quote", className]} {style} {...scopeAttributes(attributes)}>
  <blockquote style="margin: 0; padding: 0">
    <p dir="auto">{comment}</p>
  </blockquote
  ><figcaption>{author}</figcaption>
</figure>
