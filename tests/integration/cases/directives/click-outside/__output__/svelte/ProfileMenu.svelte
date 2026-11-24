<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { vClickOutside } from "./vClickOutside.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "onclosed" | "children" | "class" | "style" | "ref"
  > & {
    onclosed?: () => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { onclosed, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let open = $state(false);

  function close() {
    if (!open) return;
    open = false;
    onclosed?.();
  }
</script>

<section
  class={["profile-menu", className]}
  aria-label="Profile"
  {style}
  bind:this={ref}
  {...attributes}
>
  <div class="menu" {@attach vClickOutside(() => close)}>
    <button type="button" aria-expanded={open} onclick={() => (open = !open)}>Account</button
    >{#if open}
      <ul aria-label="Account actions">
        <li>
          <button type="button">Settings</button>
        </li
        ><li>
          <button type="button">Sign out</button>
        </li>
      </ul>
    {/if}
  </div
  ><p>Outside the menu</p>
</section>
