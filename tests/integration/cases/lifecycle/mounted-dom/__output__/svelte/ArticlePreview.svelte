<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ArticlePreviewProps {
    title: string;
    text: string;
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["article"],
    "title" | "text" | "onready" | "children" | "class" | "style" | "ref"
  > &
    ArticlePreviewProps & {
      onready?: (characters: number) => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["article"] | null;
    };

  let {
    title,
    text,
    onready,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let body: HTMLParagraphElement | null = null;
  let characters = $state(0);
  let counted = $state(false);

  onMount(() => {
    const length = body?.textContent?.length ?? 0;
    characters = length;
    counted = true;
    onready?.(length);
  });
</script>

<article
  class={["article-preview", className]}
  aria-label={title}
  {style}
  bind:this={ref}
  {...attributes}
>
  <h2>{title}</h2
  ><p bind:this={body}>{text}</p
  ><p role="status">{counted ? `${characters} characters` : "Counting the characters"}</p>
</article>
