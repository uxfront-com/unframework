<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["p"], "strong" | "children" | "class" | "style" | "ref"> & {
    strong: boolean;
    children?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["p"] | null;
  };

  let {
    strong,
    children,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<p class={["emphasis", className]} {style} bind:this={ref} {...attributes}>
  {#if strong}
    <b>{@render children?.()}</b>
  {:else}
    <i>{@render children?.()}</i>
  {/if}
</p>
