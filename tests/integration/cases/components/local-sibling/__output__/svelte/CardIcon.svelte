<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { symbol }: { symbol: string } = $props();
</script>

<span class="icon" aria-hidden="true">{symbol}</span>
