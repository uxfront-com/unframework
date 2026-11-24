<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Card from "./Card.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["article"],
    "author" | "children" | "class" | "style" | "ref" | "header" | "footer"
  > & {
    author: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["article"] | null;
  };

  let { author, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<Card class={className} {style} bind:ref {...attributes}>
  <p>Slots arrive in M3.</p
  >{#snippet header()}
    <h2>Release notes</h2>
  {/snippet}{#snippet footer()}
    <small>By {author}</small>
  {/snippet}
</Card>
