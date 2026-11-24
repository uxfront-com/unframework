<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, HTMLOlAttributes } from "svelte/elements";

  type Props = Omit<
    HTMLOlAttributes,
    "steps" | "marker" | "children" | "class" | "style" | "ref"
  > & {
    steps: string[];
    marker?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["ol"] | null;
  };

  let {
    steps,
    marker,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<ol class={["steps", className]} {style} bind:this={ref} {...attributes}>
  {#each steps as step (step)}
    <li>{@render marker?.()}{step}</li>
  {/each}
</ol>
