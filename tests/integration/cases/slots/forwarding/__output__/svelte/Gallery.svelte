<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Frame from "./Frame.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();
</script>

<div class={className} {style}>
  <Frame label="Filled">
    <p>Taken at dusk.</p
    >{#snippet title()}Sunset{/snippet}
  </Frame
  ><Frame label="Empty" />
</div>
