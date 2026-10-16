<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    label: string;
    title?: Snippet;
    children?: Snippet;
    class?: ClassValue;
    style?: string;
  };

  let { label, title, children, class: className, style }: Props = $props();
</script>

<section class={["card", className]} aria-label={label} {style}>
  {#if title}
    <header class="title">{@render title?.()}</header>
  {/if}{#if children}
    <div class="body">{@render children?.()}</div>
  {:else}
    <p>Empty card</p>
  {/if}
</section>
