<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLFieldsetAttributes } from "svelte/elements";

  type Props = Omit<HTMLFieldsetAttributes, "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["fieldset"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let plan = $state("monthly");
</script>

<fieldset class={className} {style} bind:this={ref} {...attributes}>
  <legend>Billing</legend
  ><label><input type="radio" name="plan" value="monthly" bind:group={plan} /> Monthly</label
  ><label><input type="radio" name="plan" value="yearly" bind:group={plan} /> Yearly</label
  ><output>Plan: {plan}</output
  ><button type="button" onclick={() => (plan = "monthly")}>Reset</button>
</fieldset>
