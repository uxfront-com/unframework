<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLButtonAttributes } from "svelte/elements";

  interface ChipProps {
    label: string;
  }

  type Props = Omit<HTMLButtonAttributes, "label" | "onremove" | "children" | "class" | "style" | "ref"> & ChipProps & {
    onremove?: (label: string) => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["button"] | null;
  };

  let { class: className, style, ref = $bindable(null), onclick, ...props }: Props = $props();

  let { label: _label, onremove: _onremove, ...attributes } = $derived(props);
</script>

<button
  type="button"
  onclick={(event) => {
    props.onremove?.(props.label);
    onclick?.(event);
  }}
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
>{props.label}</button>
