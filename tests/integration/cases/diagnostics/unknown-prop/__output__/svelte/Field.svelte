<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { label }: { label: string } = $props();
</script>

<label>{label} <input type="text" /></label>
