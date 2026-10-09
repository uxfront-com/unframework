<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { label }: { label: string } = $props();
</script>

<div class="card">
  <strong>{label}</strong>
</div>
