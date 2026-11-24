<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "label" | "title" | "children" | "class" | "style" | "ref"
  > & {
    label: string;
    title?: Snippet;
    children?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let {
    label,
    title,
    children,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<section class={["card", className]} aria-label={label} {style} bind:this={ref} {...attributes}>
  {#if title}
    <header class="title">{@render title?.()}</header>
  {/if}{#if children}
    <div class="body">{@render children?.()}</div>
  {:else}
    <p>Empty card</p>
  {/if}
</section>
