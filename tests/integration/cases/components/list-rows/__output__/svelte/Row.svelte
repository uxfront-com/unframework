<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { name, done }: { name: string; done: boolean } = $props();
</script>

<div role="listitem" class={["row", { done }]}>{name}{done ? " (done)" : ""}</div>
