<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["article"],
    "title" | "children" | "class" | "style" | "ref"
  > & {
    title: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["article"] | null;
  };

  let { title, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let nested = $state(false);
</script>

<article class={className} {style} bind:this={ref} {...attributes}>
  <svelte:element this={nested ? "h3" : "h2"} class="title">{title}</svelte:element
  ><button type="button" onclick={() => (nested = !nested)}>{nested ? "Lift" : "Nest"}</button>
</article>
