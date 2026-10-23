<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface ArticleSkeletonProps {
    title: string;
    summary?: string;
    minutes?: number;
  }

  type Props = ArticleSkeletonProps & { class?: ClassValue; style?: string };

  let { class: className, style, ..._props }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<article
  class={["article-skeleton", className]}
  aria-busy="true"
  aria-label="Loading article"
  {style}
  {...scopeAttributes(_props)}
>
  <p>Loading the article</p>
</article>
