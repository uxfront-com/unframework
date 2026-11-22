<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "title" | "open" | "children" | "class" | "style" | "ref"
  > & {
    title: string;
    open?: boolean;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let {
    title,
    open = $bindable(false),
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<div class={["disclosure", className]} {style} bind:this={ref} {...attributes}>
  <button type="button" aria-expanded={open} onclick={() => (open = !open)}>{title}</button
  >{#if open}
    <p>Details of {title}</p>
  {/if}
</div>
