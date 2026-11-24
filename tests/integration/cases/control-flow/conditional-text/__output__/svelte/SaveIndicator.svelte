<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface SaveIndicatorProps {
    saving: boolean;
    changes: number;
    savedAt?: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["p"],
    "saving" | "changes" | "savedAt" | "children" | "class" | "style" | "ref"
  > &
    SaveIndicatorProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["p"] | null;
    };

  let {
    saving,
    changes,
    savedAt,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<p class={["save-indicator", className]} role="status" {style} bind:this={ref} {...attributes}>
  {#if saving}<em>Saving</em>{:else}Saved{/if}, {changes === 1 ? "1 change" : `${changes} changes`}{#if savedAt}<time
    datetime={savedAt}
  >{" at " + savedAt}</time>{:else}{" just now"}{/if}
</p>
