<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { text, tone }: { text: string; tone: "info" | "quiet" } = $props();
</script>

<p role="status" class={["notice", tone]}>{text}</p>
