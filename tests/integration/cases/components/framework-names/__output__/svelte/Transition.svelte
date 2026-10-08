<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { step }: { step: string } = $props();
</script>

<p class="step">Step: {step}</p>
