<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { onclosed?: () => void; class?: ClassValue; style?: string };

  let { onclosed, class: className, style, ...attributes }: Props = $props();

  let open = $state(false);
  let menu: HTMLDivElement | null = null;

  function onDocumentClick(event: MouseEvent) {
    const element = menu;
    if (open && element && !element.contains(event.target as Node)) {
      open = false;
      onclosed?.();
    }
  }

  onMount(() => {
    document.addEventListener("click", onDocumentClick);
  });

  onMount(() => () => {
    document.removeEventListener("click", onDocumentClick);
  });

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["profile-menu", className]}
  aria-label="Profile"
  {style}
  {...scopeAttributes(attributes)}
>
  <div class="menu" bind:this={menu}>
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
