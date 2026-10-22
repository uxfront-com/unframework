<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Note from "./Note.svelte";
  import type { ClassValue } from "svelte/elements";
  import "./Article.uf.tsx.css";

  type Props = { title: string; note: string; class?: ClassValue; style?: string };

  let { title, note, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<article
  class={["article", className]}
  {style}
  data-uf-15946226=""
  {...scopeAttributes(attributes)}
>
  <h2 class="title" data-uf-15946226="">{title}</h2
  ><Note text={note} {...{ "data-uf-15946226": "" }} />
</article>
