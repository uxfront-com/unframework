<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  interface ChipProps {
    label: string;
  }

  type Props = ChipProps & {
    onremove?: (label: string) => void;
    class?: ClassValue;
    style?: string;
  };

  let { class: className, style, ...props }: Props = $props();
</script>

<button
  type="button"
  onclick={() => props.onremove?.(props.label)}
  class={className}
  {style}
>{props.label}</button>
