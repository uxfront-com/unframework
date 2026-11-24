<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLButtonAttributes } from "svelte/elements";

  type Props = Omit<HTMLButtonAttributes, "onsave" | "children" | "class" | "style" | "ref"> & {
    onsave?: () => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["button"] | null;
  };

  let {
    onsave,
    class: className,
    style,
    ref = $bindable(null),
    onclick,
    ...attributes
  }: Props = $props();
</script>

<button
  type="button"
  onclick={(event) => {
    onsave?.();
    onclick?.(event);
  }}
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
>Save</button>
