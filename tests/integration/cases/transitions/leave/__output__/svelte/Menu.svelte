<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { enter, leave } from "./_unframework/transition";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Menu.uf.tsx.css";

  type Props = Omit<SvelteHTMLElements["nav"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["nav"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let open = $state(true);
</script>

<nav
  class={["menu", className]}
  aria-label="Account"
  {style}
  data-uf-e688a71a=""
  bind:this={ref}
  {...attributes}
>
  <button
    type="button"
    aria-expanded={open}
    onclick={() => (open = !open)}
    data-uf-e688a71a=""
  >Account</button
  >{#if open}
    <ul in:enter={"fade"} out:leave={"fade"} class="items" data-uf-e688a71a="">
      <li data-uf-e688a71a="">Profile</li
      ><li data-uf-e688a71a="">Sign out</li>
    </ul>
  {/if}
</nav>
