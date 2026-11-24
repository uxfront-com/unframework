<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLFormAttributes } from "svelte/elements";

  type Props = Omit<HTMLFormAttributes, "steps" | "score" | "label" | "mode" | "children" | "class" | "style" | "ref"> & {
    steps: string[];
    score: number;
    label: string;
    mode: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["form"] | null;
  };

  let { steps, score, label, mode, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<form class={className} {style} bind:this={ref} {...attributes}>
  <ol>
    {#each steps as step, index (step)}
      <li {...{ value: steps.length - 1 - index }}>{step}</li>
    {/each}
  </ol
  ><meter min="0" max="10" {...{ value: score }} title={"Score \u0026 \"rank\""}>m</meter
  ><progress max="10" value={score}>p</progress><data {...{ value: label }}>d</data
  ><button type="button" {...{ value: label }}>b</button
  ><input type="checkbox" name="c" {...{ value: mode }} />
</form>
