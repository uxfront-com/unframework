<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Names from "./Names.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["ul"], "names" | "children" | "class" | "style" | "ref"> & {
    names: string[];
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["ul"] | null;
  };

  let { names, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<Names {names} class={className} {style} bind:ref {...attributes}>
  {#snippet children({ item })}
    <b>{item}!</b>
  {/snippet}
</Names>
