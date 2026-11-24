<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "body" | "children" | "class" | "style" | "ref"> & {
    body?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { body, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let first = $state(true);
</script>

<div class={["choice", className]} {style} bind:this={ref} {...attributes}>
  {#if first}
    <b>{@render body?.()}</b>
  {:else}
    <i>{@render body?.()}</i>
  {/if}<button type="button" onclick={() => (first = !first)}>Switch</button>
</div>
