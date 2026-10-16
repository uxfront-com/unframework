<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { tag, text }: { tag: "h1" | "h2" | "h3"; text: string } = $props();
</script>

<svelte:element this={tag} class="heading">{text}</svelte:element>
