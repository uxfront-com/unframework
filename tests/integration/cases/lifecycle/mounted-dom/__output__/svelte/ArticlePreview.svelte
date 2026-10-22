<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassValue } from "svelte/elements";

  export interface ArticlePreviewProps {
    title: string;
    text: string;
  }

  type Props = ArticlePreviewProps & {
    onready?: (characters: number) => void;
    class?: ClassValue;
    style?: string;
  };

  let { title, text, onready, class: className, style, ...attributes }: Props = $props();

  let body: HTMLParagraphElement | null = null;
  let characters = $state(0);
  let counted = $state(false);

  onMount(() => {
    const length = body?.textContent?.length ?? 0;
    characters = length;
    counted = true;
    onready?.(length);
  });

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<article
  class={["article-preview", className]}
  aria-label={title}
  {style}
  {...scopeAttributes(attributes)}
>
  <h2>{title}</h2
  ><p bind:this={body}>{text}</p
  ><p role="status">{counted ? `${characters} characters` : "Counting the characters"}</p>
</article>
