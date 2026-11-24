<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { modelText } from "./_unframework/modelText.svelte";
  import { untrack } from "svelte";
  import type { ClassValue, HTMLFormAttributes } from "svelte/elements";

  type Props = Omit<HTMLFormAttributes, "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["form"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let name = $state("");
  let city = $state("Lisbon");
  let weight = $state(0);

  const nameField = { value: untrack(() => name) };
  const cityField = { value: untrack(() => city) };
  const weightField = { value: untrack(() => weight) };
</script>

<form aria-label="Profile" class={className} {style} bind:this={ref} {...attributes}>
  <label>Name <input
    {...nameField} {@attach modelText(() => name, (value) => (name = value), { trim: true })}
  /></label
  ><label>City <input
    {...cityField} {@attach modelText(() => city, (value) => (city = value), { lazy: true })}
  /></label
  ><label>Weight <input
    {...weightField} {@attach modelText(() => weight, (value) => (weight = value), { number: true })}
  /></label
  ><output>[{name}] from {city}, {weight + 1}</output>
</form>
