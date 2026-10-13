<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { tone }: { tone: "info" | "warning" } = $props();
</script>

<span class={["badge", tone]}>{tone}</span>
