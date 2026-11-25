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

  let message = $state("Thanks, see you soon");
  let signature = $state("Ada");
</script>

<form aria-label="Reply" class={className} {style} bind:this={ref} {...attributes}>
  <textarea
    aria-label="Message"
    value={untrack(() => message)} {@attach modelText(() => message, (value) => (message = value), { trim: true })}
  ></textarea
  ><textarea
    aria-label="Signature"
    value={untrack(() => signature)} {@attach modelText(() => signature, (value) => (signature = value), { lazy: true })}
  ></textarea
  ><output>[{message}] from {signature}</output>
</form>
