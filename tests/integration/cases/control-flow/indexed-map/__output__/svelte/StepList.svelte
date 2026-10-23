<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface StepListProps {
    title: string;
    steps: string[];
  }

  type Props = StepListProps & { class?: ClassValue; style?: string };

  let { title, steps, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<ol class={["step-list", className]} aria-label={title} {style} {...scopeAttributes(attributes)}>
  {#each steps as step, index (index)}
    <li data-step={index + 1}>Step {index + 1}: {step}</li>
  {/each}
</ol>
