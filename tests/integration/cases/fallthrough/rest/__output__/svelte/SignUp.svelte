<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Field from "./Field.svelte";
  import type { ClassValue, HTMLFormAttributes } from "svelte/elements";

  type Props = Omit<HTMLFormAttributes, "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["form"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let focuses = $state(0);
</script>

<form aria-label="Sign up" class={className} {style} bind:this={ref} {...attributes}>
  <p id="email-hint">We never share it.</p
  ><Field
    label="Email"
    id="email"
    aria-describedby="email-hint"
    placeholder="you@example.com"
    class="wide"
    style="margin-top: 4px"
    onfocus={() => focuses++}
  /><p>Focuses: {focuses}</p>
</form>
