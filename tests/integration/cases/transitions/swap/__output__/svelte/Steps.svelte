<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { enter, leave } from "./_unframework/transition";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Steps.uf.tsx.css";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let first = $state(true);
  let step = $state(1);
</script>

<section
  class={["steps", className]}
  aria-label="Checkout"
  {style}
  data-uf-84fe8ccf=""
  bind:this={ref}
  {...attributes}
>
  <button type="button" onclick={() => (first = !first)} data-uf-84fe8ccf="">Swap</button
  >{#if first}
    <p in:enter={"swap"} out:leave={"swap"} class="card" data-uf-84fe8ccf="">Cart</p>
  {:else}
    <p in:enter={"swap"} out:leave={"swap"} class="card" data-uf-84fe8ccf="">Payment</p>
  {/if}<button type="button" onclick={() => (step = (step % 3) + 1)} data-uf-84fe8ccf="">Next</button
  >{#if step === 1}
    <p in:enter={"step"} out:leave={"step"} class="step" data-uf-84fe8ccf="">Step one</p>
  {:else if step === 2}
    <p in:enter={"step"} out:leave={"step"} class="step" data-uf-84fe8ccf="">Step two</p>
  {:else}
    <p in:enter={"step"} out:leave={"step"} class="step" data-uf-84fe8ccf="">Step three</p>
  {/if}
</section>
