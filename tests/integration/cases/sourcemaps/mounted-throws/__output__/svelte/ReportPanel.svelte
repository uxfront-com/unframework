<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Chart from "./Chart.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let open = $state(false);

  function show() {
    open = true;
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section aria-label="Report" class={className} {style} {...scopeAttributes(attributes)}>
  <button type="button" onclick={show}>Show the chart</button
  >{#if open}
    <Chart />
  {/if}
</section>
