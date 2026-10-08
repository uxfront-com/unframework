<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  type Props = { onsave?: () => void };

  let { onsave }: Props = $props();
</script>

<button type="button" onclick={() => onsave?.()}>Save</button>
