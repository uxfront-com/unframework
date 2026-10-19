<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Legend from "./Legend.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { series: string[]; class?: ClassValue; style?: string };

  let { series, class: className, style }: Props = $props();
</script>

<div class={className} {style}>
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
