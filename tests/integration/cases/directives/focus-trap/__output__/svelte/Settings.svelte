<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { vFocusTrap } from "./vFocusTrap.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let open = $state(false);

  function close() {
    open = false;
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") close();
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["settings", className]}
  aria-label="Settings"
  {style}
  {...scopeAttributes(attributes)}
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
