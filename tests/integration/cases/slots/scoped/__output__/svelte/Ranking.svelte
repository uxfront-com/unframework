<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import List from "./List.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "names" | "children" | "class" | "style" | "ref"> & {
    names: string[];
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { names, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div class={className} {style} bind:this={ref} {...attributes}>
  <List items={names} label="Podium">
    {#snippet item({ item, index })}
      <span>{index + 1}. <b>{item}</b></span>
    {/snippet}
  </List
  ><List items={names} label="Initials">
    {#snippet item(entry)}
      <i>{entry.item.slice(0, 1)}</i>
    {/snippet}
  </List>
</div>
