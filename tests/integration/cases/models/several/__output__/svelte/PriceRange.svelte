<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { label: string; min?: number; max?: number; class?: ClassValue; style?: string };

  let {
    label,
    min = $bindable(0),
    max = $bindable(100),
    class: className,
    style,
  }: Props = $props();

  function widen() {
    min -= 10;
    max += 10;
  }
</script>

<fieldset class={className} {style}>
  <legend>{label}</legend
  ><p>From {min} to {max}</p
  ><button type="button" onclick={widen}>Widen</button>
</fieldset>
