<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue, HTMLButtonAttributes } from "svelte/elements";

  type Props = Omit<HTMLButtonAttributes, "label" | "children" | "class" | "style" | "ref"> & {
    label?: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["button"] | null;
  };

  let { label, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  untrack(() => {
    if (process.env.NODE_ENV !== "production") {
      if (!label) console.warn("IconButton has no accessible name: pass it a `label`.");
    }
  });
</script>

<button type="button" aria-label={label} class={className} {style} bind:this={ref} {...attributes}>
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M8 1l2 5h5l-4 3 2 6-5-4-5 4 2-6-4-3h5z" />
  </svg>
</button>
