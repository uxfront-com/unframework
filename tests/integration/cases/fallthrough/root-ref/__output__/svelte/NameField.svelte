<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassValue, HTMLInputAttributes } from "svelte/elements";

  type Props = Omit<HTMLInputAttributes, "label" | "children" | "class" | "style" | "ref"> & {
    label: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["input"] | null;
  };

  let {
    label,
    class: className,
    style,
    ref = $bindable(null),
    onfocus,
    ...attributes
  }: Props = $props();

  let input: HTMLInputElement | null = null;
  let mounted = $state(false);

  onMount(() => {
    mounted = input !== null;
  });

  function fill() {
    if (input && !input.value && mounted) input.value = "Ada";
  }
</script>

<input
  bind:this={() => input, (element) => {
    input = element;
    ref = element;
  }}
  name="name"
  aria-label={label}
  onfocus={(event) => {
    fill();
    onfocus?.(event);
  }}
  class={className}
  {style}
  {...attributes}
/>
