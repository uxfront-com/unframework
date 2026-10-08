<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  interface ChipProps {
    label: string;
  }

  type Props = ChipProps & { onremove?: (label: string) => void };

  let props: Props = $props();
</script>

<button type="button" onclick={() => props.onremove?.(props.label)}>{props.label}</button>
