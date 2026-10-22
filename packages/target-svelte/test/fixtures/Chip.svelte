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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<button
  type="button"
  onclick={() => props.onremove?.(props.label)}
  class={className}
  {style}
  {...scopeAttributes(props)}
>{props.label}</button>
