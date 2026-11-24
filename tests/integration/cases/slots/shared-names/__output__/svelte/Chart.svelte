<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Legend from "./Legend.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "series" | "children" | "class" | "style" | "ref"
  > & {
    series: string[];
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { series, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div class={className} {style} bind:this={ref} {...attributes}>
  <Legend items={series} label="Series">
    {#snippet swatch({ item })}
      <b>{item.slice(0, 1)}</b>
    {/snippet}{#snippet caption({ item })}
      <i>{item}</i>
    {/snippet}
  </Legend
  ><Legend items={series} label="Captions">
    {#snippet caption({ item })}
      <span>{item.toUpperCase()}</span>
    {/snippet}
  </Legend>
</div>
