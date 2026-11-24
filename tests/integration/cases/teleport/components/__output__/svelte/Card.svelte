<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "children" | "class" | "style" | "ref"> & {
    children?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { children, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let open = $state(false);
</script>

<div class={["card", className]} {style} bind:this={ref} {...attributes}>
  <button type="button" onclick={() => (open = !open)}>Toggle card</button
  >{#if open}
    <div class="body">{@render children?.()}</div>
  {/if}
</div>
