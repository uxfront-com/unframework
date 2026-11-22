<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import KeepAlive from "./KeepAlive.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "level" | "children" | "class" | "style" | "ref"> & {
    level: number;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { level, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div class={["level", className]} {style} bind:this={ref} {...attributes}>
  <span>Level {level}</span
  >{#if level > 0}
    <KeepAlive level={level - 1} />
  {/if}
</div>
