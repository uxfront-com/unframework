<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Note from "./Note.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Article.uf.tsx.css";

  type Props = Omit<
    SvelteHTMLElements["article"],
    "title" | "note" | "children" | "class" | "style" | "ref"
  > & {
    title: string;
    note: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["article"] | null;
  };

  let {
    title,
    note,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<article class={["article", className]} {style} data-uf-15946226="" bind:this={ref} {...attributes}>
  <h2 class="title" data-uf-15946226="">{title}</h2
  ><Note text={note} {...{ "data-uf-15946226": "" }} />
</article>
