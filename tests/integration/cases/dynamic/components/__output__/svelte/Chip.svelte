<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { label }: { label: string } = $props();
</script>

<span class="chip">{label}</span>
