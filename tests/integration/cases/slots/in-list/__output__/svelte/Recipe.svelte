<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Steps from "./Steps.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { steps: string[]; class?: ClassValue; style?: string };

  let { steps, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={className} {style} {...scopeAttributes(attributes)}>
  <Steps {steps}>
    {#snippet marker()}
      <span aria-hidden="true">{"\u003e "}</span>
    {/snippet}
  </Steps>
</div>
