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
  let refreshes = $state(0);

  function refresh() {
    refreshes++;
    open = false;
    setTimeout(() => {
      open = true;
    }, 80);
  }
</script>

<nav
  class={["menu", className]}
  aria-label="Account"
  {style}
  data-uf-e688a71a=""
  bind:this={ref}
  {...attributes}
>
  <button type="button" aria-expanded={open} onclick={refresh} data-uf-e688a71a="">Refresh</button
  ><p role="status" data-uf-e688a71a="">Refreshes: {refreshes}</p
  >{#if open}
    <ul in:enter={"fade"} out:leave={"fade"} class="items" data-uf-e688a71a="">
      <li data-uf-e688a71a="">Profile</li>
    </ul>
  {/if}
</nav>
