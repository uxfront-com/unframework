<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface StepListProps {
    title: string;
    steps: string[];
  }
</script>

<script lang="ts">
  import type { ClassValue, HTMLOlAttributes } from "svelte/elements";

  type Props = Omit<HTMLOlAttributes, "title" | "steps" | "children" | "class" | "style" | "ref"> &
    StepListProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["ol"] | null;
    };

  let {
    title,
    steps,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<ol class={["step-list", className]} aria-label={title} {style} bind:this={ref} {...attributes}>
  {#each steps as step, index (index)}
    <li data-step={index + 1}>Step {index + 1}: {step}</li>
  {/each}
</ol>
