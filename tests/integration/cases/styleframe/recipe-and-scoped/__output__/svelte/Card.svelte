<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";
  import { button } from "virtual:styleframe";
  import "virtual:styleframe.css";
  import "./Card.uf.tsx.css";

  type Props = { title: string; class?: ClassValue; style?: string };

  let { title, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<article
  class={["card", button({ size: "lg", tone: "primary" }), className]}
  {style}
  data-uf-9cfb6163=""
  {...scopeAttributes(attributes)}
>
  <h2 class="title" data-uf-9cfb6163="">{title}</h2>
</article>
