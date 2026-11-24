<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLButtonAttributes } from "svelte/elements";

  type Props = Omit<
    HTMLButtonAttributes,
    "label" | "onpick" | "children" | "class" | "style" | "ref"
  > & {
    label: string;
    onpick?: (label: string) => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["button"] | null;
  };

  let {
    label,
    onpick,
    class: className,
    style,
    ref = $bindable(null),
    onclick,
    ...attributes
  }: Props = $props();
</script>

<button
  type="button"
  class={["chip", className]}
  onclick={(event) => {
    onpick?.(label);
    onclick?.(event);
  }}
  {style}
  bind:this={ref}
  {...attributes}
>{label}</button>
