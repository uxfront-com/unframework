<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ArticleProps {
    title: string;
    body: string;
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = ArticleProps & { class?: ClassValue; style?: string };

  let { title, body, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<article class={["article", className]} {style} {...scopeAttributes(attributes)}>
  <h2>{title}</h2
  ><div class="body">{@html body}</div
  ><footer>{@html "<small>Filed under <em>News</em></small>"}</footer>
</article>
