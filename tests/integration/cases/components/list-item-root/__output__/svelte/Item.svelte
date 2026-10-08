<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { label }: { label: string } = $props();
</script>

<li class="item">{label}</li>
