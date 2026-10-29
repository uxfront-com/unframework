<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ArticleTeaserProps {
    title: string;
    summary: string;
    author: string;
    minutes?: number;
    featured?: boolean;
    category?: string;
    pinned?: boolean;
    layout?: "row" | "column";
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = ArticleTeaserProps & { class?: ClassValue; style?: string };

  let { title, summary, minutes = 5, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<article
  class={["article-teaser", className]}
  aria-label={title}
  {style}
  {...scopeAttributes(attributes)}
>
  <h2>{title}</h2
  ><p>{summary}</p
  ><p class="article-teaser-meta">{minutes} min read</p>
</article>
