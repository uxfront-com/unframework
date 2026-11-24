<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { vFocusTrap } from "./vFocusTrap.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let open = $state(false);

  function close() {
    open = false;
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") close();
  }
</script>

<section
  class={["settings", className]}
  aria-label="Settings"
  {style}
  bind:this={ref}
  {...attributes}
>
  <button type="button" onclick={() => (open = true)}>Open</button
  >{#if open}{@const focusTrapValue = open}<div
    role="dialog"
    aria-label="Preferences"
    tabindex="-1"
    class="dialog"
    {@attach vFocusTrap(() => focusTrapValue)}
    onkeydown={onKeydown}
  ><button type="button">Theme</button><button type="button">Language</button><button
    type="button"
    onclick={close}
  >Close</button></div>{/if}
</section>
