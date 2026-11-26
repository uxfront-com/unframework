<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface TipProps {
    label: string;
  }
</script>

<script lang="ts">
  import { teleport } from "./_unframework/teleport";
  import { onMount } from "svelte";

  let { label }: TipProps = $props();

  let mounted = $state(false);

  onMount(() => {
    mounted = true;
  });
</script>

{#if mounted}
  <p {@attach teleport("body")} data-teleported="true" class="tip" role="note">{label} tip</p>
{/if}
