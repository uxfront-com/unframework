<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { label }: { label: string } = $props();
</script>

<label class="field">{label} <input name={label.toLowerCase()} /></label>
