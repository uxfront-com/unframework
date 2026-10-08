<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { label }: { label: string } = $props();
</script>

<span class="tag" style="padding: 2px 6px; color: rgb(30, 30, 30)">{label}</span>
