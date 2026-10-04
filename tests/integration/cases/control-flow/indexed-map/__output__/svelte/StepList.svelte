<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface StepListProps {
    title: string;
    steps: string[];
  }

  let { title, steps }: StepListProps = $props();
</script>

<ol class="step-list" aria-label={title}>
  {#each steps as step, index (index)}
    <li data-step={index + 1}>Step {index + 1}: {step}</li>
  {/each}
</ol>
